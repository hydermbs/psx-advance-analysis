import pandas as pd
from typing import Dict, Any
from app.analysis.indicators import add_all_indicators
from app.analysis.market_structure import get_market_structure
from app.analysis.candlesticks import detect_candlestick_patterns
from app.analysis.confluence import get_confluence_signal

def run_analysis_pipeline(df: pd.DataFrame, min_bars: int = 20, timeframe: str = '1d') -> Dict[str, Any]:
    """
    Orchestrates all analysis modules on a standardized OHLCV DataFrame.

    `timeframe` ('1d' or 'int') tunes indicator periods, market-structure
    sensitivity and signal weighting so intraday sessions and daily EOD are each
    analysed appropriately.
    """
    if df.empty or len(df) < min_bars:
        return {
            'status': 'error',
            'message': f'Insufficient data points (minimum {min_bars} required, got {len(df)})',
            'data': {}
        }

    # 1. Add Technical Indicators (SMA, EMA, RSI, MACD, BB)
    df_indicators = add_all_indicators(df, timeframe=timeframe)

    # 2. Extract Market Structure (Swings, Dow trend, Stan Weinstein Stage)
    market_struct = get_market_structure(df_indicators, timeframe=timeframe)

    # 3. Detect Candlestick Patterns (Hammer, Shooting Star, Engulfing, etc.)
    patterns = detect_candlestick_patterns(df_indicators)

    # 4. Generate confluence BUY/SELL/HOLD signals and Risk levels
    signal_results = get_confluence_signal(df_indicators, market_struct, patterns, timeframe=timeframe)
    
    # 5. Format OHLCV + Indicators data for frontend charting
    # Convert dates to ISO strings for JSON serialization
    chart_data = []
    for idx, row in df_indicators.iterrows():
        date_val = row['date']
        dt_str = date_val.isoformat() if hasattr(date_val, 'isoformat') else str(date_val)
        
        record = {
            'time': dt_str,
            'open': float(row['open']),
            'high': float(row['high']),
            'low': float(row['low']),
            'close': float(row['close']),
            'volume': float(row['volume'])
        }
        
        # Add technical indicators if they are not NaN
        for col in ['sma_20', 'sma_50', 'sma_200', 'ema_20', 'ema_50', 'ema_200',
                    'rsi', 'macd_line', 'macd_signal', 'macd_hist',
                    'bb_upper', 'bb_middle', 'bb_lower']:
            if col in row and not pd.isna(row[col]):
                record[col] = float(row[col])
                
        chart_data.append(record)
        
    # Return structured results
    return {
        'status': 'success',
        'symbol_data': chart_data,
        'market_structure': {
            'dow_trend': market_struct.get('dow_trend', 'SIDEWAYS'),
            'market_stage': market_struct.get('market_stage', 'UNKNOWN'),
            'ema_200_slope': float(market_struct.get('ema_200_slope', 0.0))
        },
        'swings': market_struct.get('swings', []),
        'patterns': patterns,
        'signals': signal_results
    }
