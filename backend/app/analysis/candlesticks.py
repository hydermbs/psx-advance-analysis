import pandas as pd
import numpy as np
from typing import List, Dict, Any

def detect_candlestick_patterns(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Detects key candlestick patterns in the historical DataFrame.
    Returns:
        List[Dict] of detected patterns with keys: 'date', 'pattern', 'type' (bullish/bearish), 'price'
    """
    patterns = []
    n = len(df)
    if n < 3:
        return patterns
        
    opens = df['open'].values
    highs = df['high'].values
    lows = df['low'].values
    closes = df['close'].values
    dates = df['date'].values
    
    # Optional Trend context using a short term EMA
    # If price is above EMA 20, we assume short-term uptrend.
    ema_20 = df['ema_20'].values if 'ema_20' in df.columns else closes
    
    for i in range(2, n):
        o, h, l, c = opens[i], highs[i], lows[i], closes[i]
        o_prev, h_prev, l_prev, c_prev = opens[i-1], highs[i-1], lows[i-1], closes[i-1]
        o_prev2, h_prev2, l_prev2, c_prev2 = opens[i-2], highs[i-2], lows[i-2], closes[i-2]
        
        body = abs(c - o)
        tr = max(h - l, 1e-9)
        upper_wick = h - max(o, c)
        lower_wick = min(o, c) - l
        
        body_prev = abs(c_prev - o_prev)
        tr_prev = max(h_prev - l_prev, 1e-9)
        
        dt_str = dates[i].isoformat() if hasattr(dates[i], 'isoformat') else str(dates[i])
        
        # 1. Doji
        if body <= 0.1 * tr:
            patterns.append({'date': dt_str, 'pattern': 'Doji', 'type': 'neutral', 'price': c})
            
        # 2. Hammer (Bullish Reversal in downtrend)
        is_downtrend = c < ema_20[i]
        if body <= 0.35 * tr and lower_wick >= 2 * body and upper_wick <= 0.1 * tr and is_downtrend:
            patterns.append({'date': dt_str, 'pattern': 'Hammer', 'type': 'bullish', 'price': l})
            
        # 3. Shooting Star (Bearish Reversal in uptrend)
        is_uptrend = c > ema_20[i]
        if body <= 0.35 * tr and upper_wick >= 2 * body and lower_wick <= 0.1 * tr and is_uptrend:
            patterns.append({'date': dt_str, 'pattern': 'Shooting Star', 'type': 'bearish', 'price': h})
            
        # 4. Bullish Engulfing
        if c_prev < o_prev and c > o and o <= c_prev and c >= o_prev and (o < c_prev or c > o_prev):
            patterns.append({'date': dt_str, 'pattern': 'Bullish Engulfing', 'type': 'bullish', 'price': l})
            
        # 5. Bearish Engulfing
        if c_prev > o_prev and c < o and o >= c_prev and c <= o_prev and (o > c_prev or c < o_prev):
            patterns.append({'date': dt_str, 'pattern': 'Bearish Engulfing', 'type': 'bearish', 'price': h})
            
        # 6. Morning Star (Bullish Reversal)
        if (c_prev2 < o_prev2 and  # Day 1 Bearish
            body_prev <= 0.3 * tr_prev and  # Day 2 Small Body
            c > o and c > (o_prev2 + c_prev2) / 2): # Day 3 Bullish closing above midpoint of Day 1
            patterns.append({'date': dt_str, 'pattern': 'Morning Star', 'type': 'bullish', 'price': l})
            
        # 7. Evening Star (Bearish Reversal)
        if (c_prev2 > o_prev2 and  # Day 1 Bullish
            body_prev <= 0.3 * tr_prev and  # Day 2 Small Body
            c < o and c < (o_prev2 + c_prev2) / 2): # Day 3 Bearish closing below midpoint of Day 1
            patterns.append({'date': dt_str, 'pattern': 'Evening Star', 'type': 'bearish', 'price': h})
            
    return patterns
