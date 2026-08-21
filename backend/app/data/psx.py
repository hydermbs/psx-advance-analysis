import re
import httpx
import pandas as pd
from typing import List, Dict, Any, Optional
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

                # The EOD feed only carries [close, volume, open] -- real intraday
                # high/low are missing, so historical bars have body-only ranges.
                # Stitch the current session's REAL O/H/L/C from market-watch onto
                # the live bar so ATR, stop-loss and the latest candle are accurate.
                df = await self._stitch_live_bar(symbol, df)
                return df

            except Exception as e:
                print(f"Error fetching PSX EOD for {symbol}: {e}")
                return pd.DataFrame(columns=['date', 'open', 'high', 'low', 'close', 'volume'])

    async def _get_market_watch(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Fetches the current session's real OHLC for a symbol from the market-watch
        table (columns: symbol, listed(MMDD), sector, ldcp, open, high, low, close,
        change, pct, volume, ...). Returns None if unavailable.
        """
        url = f"{self.base_url}/market-watch"
        async with httpx.AsyncClient(verify=False) as client:
            try:
                response = await client.get(url, headers=self.headers, timeout=10.0)
                response.raise_for_status()
                html = response.text
            except Exception as e:
                print(f"Error fetching PSX market-watch for {symbol}: {e}")
                return None

        def _num(text: str) -> Optional[float]:
            try:
                return float(text.replace(',', ''))
            except (ValueError, AttributeError):
                return None

        target = symbol.upper()
        for row in re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.S):
            cells = [re.sub('<[^>]+>', '', c).strip()
                     for c in re.findall(r'<td[^>]*>(.*?)</td>', row, re.S)]
            if len(cells) < 8 or cells[0].upper() != target:
                continue

            o, h, l, c = (_num(cells[4]), _num(cells[5]), _num(cells[6]), _num(cells[7]))
            vol = _num(cells[10]) if len(cells) > 10 else None
            if None in (o, h, l, c) or c <= 0:
                return None

            # Session date is encoded as MMDD in the "listed" column (e.g. '0820').
            session_date = datetime.now(timezone.utc)
            md = cells[1].strip()
            if len(md) == 4 and md.isdigit():
                try:
                    session_date = datetime(session_date.year, int(md[:2]), int(md[2:]),
                                            tzinfo=timezone.utc)
                except ValueError:
                    pass

            return {
                'date': session_date,
                'open': o, 'high': h, 'low': l, 'close': c,
                'volume': vol if vol is not None else 0.0,
            }
        return None

    async def _stitch_live_bar(self, symbol: str, df: pd.DataFrame) -> pd.DataFrame:
        """Append (or replace) the current session bar with real market-watch OHLC."""
        mw = await self._get_market_watch(symbol)
        if not mw:
            return df

        new_row = {k: mw[k] for k in ['date', 'open', 'high', 'low', 'close', 'volume']}
        df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)

        # Collapse to one bar per calendar day, keeping the last occurrence so the
        # real market-watch OHLC wins over the body-only EOD bar for that session.
        # (The EOD feed timestamps sessions at 11:00 UTC while the stitched bar is
        # at 00:00, so a same-day match must be de-duplicated by day, not by row --
        # otherwise the chart sees two bars sharing a date and rejects the series.)
        df['_day'] = pd.to_datetime(df['date']).dt.normalize()
        df = df.drop_duplicates(subset='_day', keep='last').drop(columns='_day')
        return df.sort_values('date').reset_index(drop=True)

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
                
                # Aggregate trades into 5-minute candles. PSX intraday only covers
                # the current session, so finer candles yield ~3x more bars, giving
                # the indicators enough history to produce a real signal.
                df.set_index('date', inplace=True)

                # Resample: open is first price, high is max, low is min, close is last, volume is sum
                resampled = df.resample('5min').agg({
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
