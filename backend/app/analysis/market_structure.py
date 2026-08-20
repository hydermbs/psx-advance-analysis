import pandas as pd
import numpy as np
from typing import List, Dict, Any, Tuple

def find_swings(df: pd.DataFrame, window: int = 5) -> List[Dict[str, Any]]:
    """
    Finds local swing highs and swing lows (pivots) in the data.
    A swing high is the highest high in a window of 2*window + 1 bars.
    """
    swings = []
    n = len(df)
    if n < 2 * window + 1:
        return swings
        
    for i in range(window, n - window):
        high_val = df['high'].iloc[i]
        low_val = df['low'].iloc[i]
        date_val = df['date'].iloc[i]
        
        # Check for swing high
        is_swing_high = True
        for j in range(i - window, i + window + 1):
            if df['high'].iloc[j] > high_val:
                is_swing_high = False
                break
        
        # Check for swing low
        is_swing_low = True
        for j in range(i - window, i + window + 1):
            if df['low'].iloc[j] < low_val:
                is_swing_low = False
                break
                
        if is_swing_high:
            swings.append({
                'index': i,
                'date': date_val,
                'type': 'high',
                'price': float(high_val)
            })
        elif is_swing_low:
            swings.append({
                'index': i,
                'date': date_val,
                'type': 'low',
                'price': float(low_val)
            })
            
    # Clean up swings to ensure they alternate (high, low, high, low)
    # If two consecutive swings are of the same type, keep the more extreme one.
    if not swings:
        return []
        
    alternating_swings = []
    current_swing = swings[0]
    
    for next_swing in swings[1:]:
        if next_swing['type'] == current_swing['type']:
            # Keep the higher high or the lower low
            if current_swing['type'] == 'high':
                if next_swing['price'] > current_swing['price']:
                    current_swing = next_swing
            else:
                if next_swing['price'] < current_swing['price']:
                    current_swing = next_swing
        else:
            alternating_swings.append(current_swing)
            current_swing = next_swing
    alternating_swings.append(current_swing)
    
    return alternating_swings

def classify_swings(swings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Classifies swings into HH (Higher High), LH (Lower High), HL (Higher Low), LL (Lower Low).
    """
    if not swings:
        return []
        
    classified = []
    last_high = None
    last_low = None
    
    for swing in swings:
        swing_copy = swing.copy()
        price = swing['price']
        
        if swing['type'] == 'high':
            if last_high is None:
                label = 'H' # First high
            elif price > last_high:
                label = 'HH'
            else:
                label = 'LH'
            last_high = price
        else:
            if last_low is None:
                label = 'L' # First low
            elif price > last_low:
                label = 'HL'
            else:
                label = 'LL'
            last_low = price
            
        swing_copy['label'] = label
        classified.append(swing_copy)
        
    return classified

def analyze_dow_theory(classified_swings: List[Dict[str, Any]]) -> str:
    """
    Determines market trend based on Dow Theory:
    Bullish: sequence of HH and HL
    Bearish: sequence of LH and LL
    Sideways: conflicting or range-bound signals
    """
    if len(classified_swings) < 4:
        return "SIDEWAYS"
        
    # Get last 4 classified swings
    recent = classified_swings[-4:]
    
    labels = [s['label'] for s in recent]
    
    # Check for bullish sequence: must have at least one HH and one HL, and no LL or LH in recent swings
    has_hh = 'HH' in labels
    has_hl = 'HL' in labels
    has_lh = 'LH' in labels
    has_ll = 'LL' in labels
    
    if has_hh and has_hl and not has_ll:
        return "BULLISH"
    elif has_lh and has_ll and not has_hl:
        return "BEARISH"
    else:
        # Check last high and low direction
        highs = [s['price'] for s in recent if s['type'] == 'high']
        lows = [s['price'] for s in recent if s['type'] == 'low']
        
        if len(highs) >= 2 and len(lows) >= 2:
            if highs[-1] > highs[-2] and lows[-1] > lows[-2]:
                return "BULLISH"
            elif highs[-1] < highs[-2] and lows[-1] < lows[-2]:
                return "BEARISH"
                
        return "SIDEWAYS"

def analyze_market_stages(df: pd.DataFrame) -> Tuple[str, float]:
    """
    Classifies the current price action into one of the 4 Market Stages (Stan Weinstein's method):
    Stage 1: Accumulation (Price oscillating around a flat 200 EMA)
    Stage 2: Advancing (Price above rising 200 EMA)
    Stage 3: Distribution (Price oscillating around flat 200 EMA after an advance)
    Stage 4: Declining (Price below falling 200 EMA)
    """
    if df.empty or 'ema_200' not in df.columns or df['ema_200'].isna().all():
        return "UNKNOWN", 0.0
        
    current_price = float(df['close'].iloc[-1])
    ema_200 = float(df['ema_200'].iloc[-1])
    
    # Calculate slope of 200 EMA over the last 20 periods
    if len(df) > 21:
        prev_ema_200 = float(df['ema_200'].iloc[-20])
        slope = (ema_200 - prev_ema_200) / prev_ema_200
    else:
        slope = 0.0
        
    # Threshold for flat EMA slope
    slope_threshold = 0.003
    
    # Classify stage
    if slope > slope_threshold:
        if current_price > ema_200:
            stage = "STAGE_2_ADVANCING"
        else:
            stage = "STAGE_1_ACCUMULATION" # Pullback in uptrend
    elif slope < -slope_threshold:
        if current_price < ema_200:
            stage = "STAGE_4_DECLINING"
        else:
            stage = "STAGE_3_DISTRIBUTION" # Bear market rally
    else:
        # Flat slope - Range-bound
        # Check if the price has been above the 200 EMA historically
        historical_price = df['close'].iloc[-60:].mean() if len(df) >= 60 else df['close'].mean()
        historical_ema = df['ema_200'].iloc[-60:].mean() if len(df) >= 60 else df['ema_200'].mean()
        
        if historical_price > historical_ema:
            stage = "STAGE_3_DISTRIBUTION"
        else:
            stage = "STAGE_1_ACCUMULATION"
            
    return stage, slope

def add_provisional_swing(df: pd.DataFrame, swings: List[Dict[str, Any]], window: int) -> List[Dict[str, Any]]:
    """
    Swings are only confirmed once `window` bars have formed after the pivot, so
    the most recent `window` bars can never be a swing -- Dow-theory trend then
    lags the chart by that many bars (a full week on daily data). This appends a
    single *provisional* pivot for the extreme forming in that unconfirmed tail,
    of the opposite type to the last confirmed swing, so the trend reflects
    recent price action instead of ignoring it.
    """
    n = len(df)
    if n == 0:
        return swings

    last_idx = swings[-1]['index'] if swings else 0
    last_type = swings[-1]['type'] if swings else None
    tail_start = last_idx + 1
    if tail_start >= n:
        return swings

    tail = df.iloc[tail_start:]
    if last_type == 'low':
        rel = int(tail['high'].values.argmax())
        pos = tail_start + rel
        pivot = {'index': pos, 'date': df['date'].iloc[pos], 'type': 'high',
                 'price': float(df['high'].iloc[pos]), 'provisional': True}
    else:
        # No confirmed swing yet, or last was a high -> forming low.
        rel = int(tail['low'].values.argmin())
        pos = tail_start + rel
        pivot = {'index': pos, 'date': df['date'].iloc[pos], 'type': 'low',
                 'price': float(df['low'].iloc[pos]), 'provisional': True}

    return swings + [pivot]


def get_market_structure(df: pd.DataFrame, timeframe: str = '1d') -> Dict[str, Any]:
    """Runs all market structure analysis and returns standard dictionary."""
    # Smaller confirmation window reduces trend lag; intraday needs it tighter still.
    swing_window = 2 if timeframe == 'int' else 3
    swings = find_swings(df, window=swing_window)
    swings = add_provisional_swing(df, swings, swing_window)
    classified = classify_swings(swings)
    dow_trend = analyze_dow_theory(classified)
    stage, slope = analyze_market_stages(df)
    
    # Convert dates to string/ISO format for JSON response
    formatted_swings = []
    for swing in classified:
        s_copy = swing.copy()
        if isinstance(s_copy['date'], pd.Timestamp) or hasattr(s_copy['date'], 'isoformat'):
            s_copy['date'] = s_copy['date'].isoformat()
        formatted_swings.append(s_copy)
        
    return {
        'swings': formatted_swings,
        'dow_trend': dow_trend,
        'market_stage': stage,
        'ema_200_slope': slope
    }
