from abc import ABC, abstractmethod
import pandas as pd
from typing import List, Dict, Any

class BaseDataAdapter(ABC):
    @abstractmethod
    async def get_symbols(self) -> List[Dict[str, Any]]:
        """
        Retrieves a list of available symbols with name, sector and metadata.
        Returns:
            List[Dict] with keys: 'symbol', 'name', 'sector', 'is_etf', 'exchange'
        """
        pass

    @abstractmethod
    async def get_ohlcv(self, symbol: str, timeframe: str) -> pd.DataFrame:
        """
        Retrieves historical OHLCV data for a symbol.
        Args:
            symbol: The stock symbol (e.g. 'SYS')
            timeframe: '1d' (EOD) or 'int' (intraday)
        Returns:
            pandas.DataFrame with columns: [date, open, high, low, close, volume]
            sorted by date ascending.
        """
        pass
