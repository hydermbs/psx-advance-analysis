import pandas as pd
import numpy as np

def calculate_sma(df: pd.DataFrame, period: int, column: str = 'close') -> pd.Series:
    return df[column].rolling(window=period).mean()

def calculate_ema(df: pd.DataFrame, period: int, column: str = 'close') -> pd.Series:
    return df[column].ewm(span=period, adjust=False).mean()

def calculate_rsi(df: pd.DataFrame, period: int = 14, column: str = 'close') -> pd.Series:
    delta = df[column].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    
    # Wilder's smoothing
    avg_gain = gain.ewm(alpha=1/period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/period, adjust=False).mean()
    
    # Avoid division by zero
    rs = avg_gain / avg_loss.replace(0, 1e-9)
    rsi = 100 - (100 / (1 + rs))
    
    # Set the first 'period' elements to NaN since they don't have enough data
    rsi.iloc[:period] = np.nan
    return rsi

def calculate_macd(df: pd.DataFrame, fast_period: int = 12, slow_period: int = 26, signal_period: int = 9, column: str = 'close') -> tuple:
    ema_fast = calculate_ema(df, fast_period, column)
    ema_slow = calculate_ema(df, slow_period, column)
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal_period, adjust=False).mean()
    macd_hist = macd_line - signal_line
    return macd_line, signal_line, macd_hist

def calculate_bollinger_bands(df: pd.DataFrame, period: int = 20, num_std: float = 2.0, column: str = 'close') -> tuple:
    middle_band = calculate_sma(df, period, column)
    std_dev = df[column].rolling(window=period).std()
    upper_band = middle_band + (num_std * std_dev)
    lower_band = middle_band - (num_std * std_dev)
    return upper_band, middle_band, lower_band

def add_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Adds standard indicators to the DataFrame."""
    if df.empty or len(df) < 5:
        return df
        
    df = df.copy()
    df['sma_20'] = calculate_sma(df, 20)
    df['sma_50'] = calculate_sma(df, 50)
    df['sma_200'] = calculate_sma(df, 200)
    df['ema_20'] = calculate_ema(df, 20)
    df['ema_50'] = calculate_ema(df, 50)
    df['ema_200'] = calculate_ema(df, 200)
    
    df['rsi'] = calculate_rsi(df, 14)
    
    macd_line, signal_line, macd_hist = calculate_macd(df)
    df['macd_line'] = macd_line
    df['macd_signal'] = signal_line
    df['macd_hist'] = macd_hist
    
    bb_upper, bb_middle, bb_lower = calculate_bollinger_bands(df)
    df['bb_upper'] = bb_upper
    df['bb_middle'] = bb_middle
    df['bb_lower'] = bb_lower
    
    return df
