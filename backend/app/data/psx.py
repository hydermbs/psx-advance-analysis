import httpx
import pandas as pd
from typing import List, Dict, Any
from datetime import datetime, timezone
from app.data.adapter import BaseDataAdapter

class PSXDataAdapter(BaseDataAdapter):
    def __init__(self):
        self.base_url = "https://dps.psx.com.pk"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

    async def get_symbols(self) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/symbols"
        async with httpx.AsyncClient(verify=False) as client:
            try:
                response = await client.get(url, headers=self.headers, timeout=10.0)
                response.raise_for_status()
                data = response.json()
                
                symbols = []
                for item in data:
                    symbols.append({
                        'symbol': item.get('symbol', ''),
                        'name': item.get('name', ''),
                        'sector': item.get('sectorName', 'Unknown'),
                        'is_etf': item.get('isETF', False),
                        'exchange': 'PSX'
                    })
                return symbols
            except Exception as e:
                print(f"Error fetching PSX symbols: {e}")
                return []

    async def get_ohlcv(self, symbol: str, timeframe: str) -> pd.DataFrame:
        if timeframe == 'int':
            return await self._get_intraday(symbol)
        else:
            return await self._get_eod(symbol)

    async def _get_eod(self, symbol: str) -> pd.DataFrame:
        url = f"{self.base_url}/timeseries/eod/{symbol}"
        async with httpx.AsyncClient(verify=False) as client:
            try:
                response = await client.get(url, headers=self.headers, timeout=10.0)
                response.raise_for_status()
                payload = response.json()
                
                raw_data = payload.get('data', [])
                if not raw_data:
                    return pd.DataFrame(columns=['date', 'open', 'high', 'low', 'close', 'volume'])
                
                # Format: [timestamp, close, volume, open]
                parsed_records = []
                for record in raw_data:
                    if len(record) >= 3:
                        ts = record[0]
                        close_val = float(record[1]) if record[1] is not None else 0.0
                        vol_val = float(record[2]) if record[2] is not None else 0.0
                        
                        # Open is the 4th element if present, otherwise default to close
                        open_val = float(record[3]) if (len(record) >= 4 and record[3] is not None) else close_val
                        
                        # Approximate High and Low since they are missing in the EOD JSON feed
                        high_val = max(open_val, close_val)
                        low_val = min(open_val, close_val)
                        
                        dt = datetime.fromtimestamp(ts, tz=timezone.utc)
                        
                        parsed_records.append({
                            'date': dt,
                            'open': open_val,
                            'high': high_val,
                            'low': low_val,
                            'close': close_val,
                            'volume': vol_val
                        })
                
                df = pd.DataFrame(parsed_records)
                # Sort chronological
                df = df.sort_values('date').reset_index(drop=True)
                return df
                
            except Exception as e:
                print(f"Error fetching PSX EOD for {symbol}: {e}")
                return pd.DataFrame(columns=['date', 'open', 'high', 'low', 'close', 'volume'])

    async def _get_intraday(self, symbol: str) -> pd.DataFrame:
        url = f"{self.base_url}/timeseries/int/{symbol}"
        async with httpx.AsyncClient(verify=False) as client:
            try:
                response = await client.get(url, headers=self.headers, timeout=10.0)
                response.raise_for_status()
                payload = response.json()
                
                raw_data = payload.get('data', [])
                if not raw_data:
                    return pd.DataFrame(columns=['date', 'open', 'high', 'low', 'close', 'volume'])
                
                # Format: [timestamp, price, volume]
                parsed_records = []
                for record in raw_data:
                    if len(record) >= 3:
                        ts = record[0]
                        price = float(record[1]) if record[1] is not None else 0.0
                        vol = float(record[2]) if record[2] is not None else 0.0
                        dt = datetime.fromtimestamp(ts, tz=timezone.utc)
                        parsed_records.append({
                            'date': dt,
                            'price': price,
                            'volume': vol
                        })
                
                df = pd.DataFrame(parsed_records)
                df = df.sort_values('date')
                
                # Aggregate trades into 5-minute candles
                df.set_index('date', inplace=True)
                
                # Resample: open is first price, high is max, low is min, close is last, volume is sum
                resampled = df.resample('5Min').agg({
                    'price': ['first', 'max', 'min', 'last'],
                    'volume': 'sum'
                })
                
                # Drop rows with no trades
                resampled.dropna(subset=[('price', 'first')], inplace=True)
                
                # Flatten the multi-index columns
                resampled.columns = ['open', 'high', 'low', 'close', 'volume']
                resampled = resampled.reset_index()
                
                return resampled
                
            except Exception as e:
                print(f"Error fetching PSX Intraday for {symbol}: {e}")
                return pd.DataFrame(columns=['date', 'open', 'high', 'low', 'close', 'volume'])
