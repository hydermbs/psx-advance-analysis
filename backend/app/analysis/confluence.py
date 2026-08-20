import pandas as pd
import numpy as np
from typing import Dict, Any, List

def calculate_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Calculates Average True Range."""
    high = df['high']
    low = df['low']
    close_prev = df['close'].shift(1)
    
    tr1 = high - low
    tr2 = (high - close_prev).abs()
    tr3 = (low - close_prev).abs()
    
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(window=period).mean()
    # Fill initial NaNs with high - low
    atr = atr.ffill().bfill()
    return atr

def get_confluence_signal(df: pd.DataFrame, market_struct: Dict[str, Any], recent_patterns: List[Dict[str, Any]], timeframe: str = '1d') -> Dict[str, Any]:
    """
    Aggregates technical metrics to output BUY/SELL/HOLD signal, confidence score,
    and trade levels (entry, stop loss, target).

    Weighting is timeframe-aware. On daily data the slow-trend factors (market
    stage + Dow theory) are deliberately down-weighted in favour of momentum so
    the signal tracks the visible chart instead of lagging it by weeks. On
    intraday (a single session) the 50/200-based structure factors are
    meaningless, so they are disabled and momentum carries the signal.
    """
    is_intraday = timeframe == 'int'
    min_required = 10 if is_intraday else 20
    if df.empty or len(df) < min_required:
        return {
            'signal': 'HOLD',
            'confidence': 0.0,
            'entry': 0.0,
            'stop_loss': 0.0,
            'target': 0.0,
            'risk_reward': 0.0,
            'factors': ['Insufficient data for signal generation']
        }
        
    current_close = float(df['close'].iloc[-1])
    current_high = float(df['high'].iloc[-1])
    current_low = float(df['low'].iloc[-1])
    
    # Compute ATR for Stop Loss calculation
    df_atr = calculate_atr(df)
    current_atr = float(df_atr.iloc[-1]) if not df_atr.empty else (current_close * 0.02)
    
    factors = []
    scores = []

    # Timeframe-aware factor weights (must sum to 1.0).
    if is_intraday:
        w_stage, w_dow, w_ind, w_candle = 0.0, 0.0, 0.70, 0.30
    else:
        w_stage, w_dow, w_ind, w_candle = 0.15, 0.15, 0.45, 0.25

    # 1. Market Stage (slow-trend structure; disabled on intraday)
    if w_stage > 0:
        stage = market_struct.get('market_stage', 'STAGE_1_ACCUMULATION')
        stage_score = 0.0
        if stage == 'STAGE_2_ADVANCING':
            stage_score = 1.0
            factors.append("Bullish: Market is in Stage 2 (Advancing)")
        elif stage == 'STAGE_4_DECLINING':
            stage_score = -1.0
            factors.append("Bearish: Market is in Stage 4 (Declining)")
        elif stage == 'STAGE_1_ACCUMULATION':
            stage_score = 0.25
            factors.append("Neutral-Bullish: Market in Stage 1 (Accumulation)")
        elif stage == 'STAGE_3_DISTRIBUTION':
            stage_score = -0.25
            factors.append("Neutral-Bearish: Market in Stage 3 (Distribution)")
        scores.append(stage_score * w_stage)

    # 2. Dow Theory Trend (slow-trend structure; disabled on intraday)
    if w_dow > 0:
        dow = market_struct.get('dow_trend', 'SIDEWAYS')
        dow_score = 0.0
        if dow == 'BULLISH':
            dow_score = 1.0
            factors.append("Bullish: Dow Theory trend is Bullish (HH/HL)")
        elif dow == 'BEARISH':
            dow_score = -1.0
            factors.append("Bearish: Dow Theory trend is Bearish (LH/LL)")
        else:
            factors.append("Neutral: Dow Theory trend is Sideways")
        scores.append(dow_score * w_dow)

    # 3. Indicators
    ind_scores = []
    
    # RSI
    rsi_val = float(df['rsi'].iloc[-1]) if 'rsi' in df.columns and not pd.isna(df['rsi'].iloc[-1]) else 50.0
    if rsi_val <= 30.0:
        ind_scores.append(1.0)
        factors.append(f"Bullish: RSI is Oversold ({rsi_val:.1f})")
    elif rsi_val >= 70.0:
        ind_scores.append(-1.0)
        factors.append(f"Bearish: RSI is Overbought ({rsi_val:.1f})")
    elif rsi_val > 55.0:
        ind_scores.append(0.3)
        factors.append(f"Bullish: RSI shows positive momentum ({rsi_val:.1f})")
    elif rsi_val < 45.0:
        ind_scores.append(-0.3)
        factors.append(f"Bearish: RSI shows negative momentum ({rsi_val:.1f})")
    else:
        ind_scores.append(0.0)
        
    # MACD
    if 'macd_line' in df.columns and 'macd_signal' in df.columns:
        macd_line = float(df['macd_line'].iloc[-1])
        macd_sig = float(df['macd_signal'].iloc[-1])
        macd_hist = float(df['macd_hist'].iloc[-1])
        
        if macd_line > macd_sig:
            score_m = 0.5
            if macd_hist > 0 and macd_hist > float(df['macd_hist'].iloc[-2]):
                score_m += 0.5
                factors.append("Bullish: MACD Crossover with expanding histogram")
            else:
                factors.append("Bullish: MACD is above Signal line")
            ind_scores.append(score_m)
        else:
            score_m = -0.5
            if macd_hist < 0 and macd_hist < float(df['macd_hist'].iloc[-2]):
                score_m -= 0.5
                factors.append("Bearish: MACD Bearish Crossover with expanding histogram")
            else:
                factors.append("Bearish: MACD is below Signal line")
            ind_scores.append(score_m)
            
    # Bollinger Bands
    if 'bb_upper' in df.columns and 'bb_lower' in df.columns:
        bb_up = float(df['bb_upper'].iloc[-1])
        bb_low = float(df['bb_lower'].iloc[-1])
        if current_close <= bb_low:
            ind_scores.append(0.8)
            factors.append("Bullish: Price touched Lower Bollinger Band")
        elif current_close >= bb_up:
            ind_scores.append(-0.8)
            factors.append("Bearish: Price touched Upper Bollinger Band")
            
    # EMA Crossovers -- require a small separation margin so a near-flat cross
    # doesn't flip the signal back and forth bar to bar.
    if 'ema_20' in df.columns and 'ema_50' in df.columns:
        ema_20 = float(df['ema_20'].iloc[-1])
        ema_50 = float(df['ema_50'].iloc[-1])
        ema_margin = 0.001 * ema_50  # 0.1% dead-band around the cross
        if ema_20 > ema_50 + ema_margin:
            ind_scores.append(0.5)
            factors.append("Bullish: Short-term EMA Golden Cross (EMA20 > EMA50)")
        elif ema_20 < ema_50 - ema_margin:
            ind_scores.append(-0.5)
            factors.append("Bearish: Short-term EMA Death Cross (EMA20 < EMA50)")
        else:
            ind_scores.append(0.0)

    avg_ind_score = np.mean(ind_scores) if ind_scores else 0.0
    scores.append(avg_ind_score * w_ind)

    # 4. Candlestick Patterns
    candle_score = 0.0
    # Check if a pattern occurred in the last 2 bars
    last_patterns = []
    if recent_patterns:
        # Get ISO string or date representation of last 2 bars
        last_dates = [df['date'].iloc[-1], df['date'].iloc[-2]]
        last_date_strs = [d.isoformat() if hasattr(d, 'isoformat') else str(d) for d in last_dates]
        
        for pat in recent_patterns:
            if pat['date'] in last_date_strs:
                last_patterns.append(pat)
                
    if last_patterns:
        bull_pats = [p for p in last_patterns if p['type'] == 'bullish']
        bear_pats = [p for p in last_patterns if p['type'] == 'bearish']
        
        if bull_pats:
            candle_score = 1.0
            factors.append(f"Bullish: Candlestick Pattern detected ({bull_pats[0]['pattern']})")
        elif bear_pats:
            candle_score = -1.0
            factors.append(f"Bearish: Candlestick Pattern detected ({bear_pats[0]['pattern']})")
            
    scores.append(candle_score * w_candle)

    # Aggregate total score
    total_score = float(np.sum(scores))
    
    # Signal thresholding
    if total_score >= 0.45:
        signal = 'STRONG_BUY'
    elif total_score >= 0.15:
        signal = 'BUY'
    elif total_score <= -0.45:
        signal = 'STRONG_SELL'
    elif total_score <= -0.15:
        signal = 'SELL'
    else:
        signal = 'HOLD'
        
    # Confidence as a percentage (0% to 100%)
    confidence = float(min(1.0, max(0.0, abs(total_score))) * 100)
    
    # Calculate Levels for risk management
    entry = current_close
    rr_ratio = 2.0 # Minimum 2:1
    
    if signal in ['STRONG_BUY', 'BUY']:
        # Stop loss is either low of last 5 bars minus 0.5 * ATR, or 1.5% below close
        recent_low = float(df['low'].iloc[-5:].min())
        stop_loss = min(recent_low - (0.5 * current_atr), entry * 0.97)
        risk = entry - stop_loss
        target = entry + (rr_ratio * risk)
    elif signal in ['STRONG_SELL', 'SELL']:
        recent_high = float(df['high'].iloc[-5:].max())
        stop_loss = max(recent_high + (0.5 * current_atr), entry * 1.03)
        risk = stop_loss - entry
        target = entry - (rr_ratio * risk)
    else:
        stop_loss = entry * 0.95
        target = entry * 1.10
        risk = entry - stop_loss
        
    return {
        'signal': signal,
        'confidence': round(confidence, 1),
        'entry': round(entry, 2),
        'stop_loss': round(stop_loss, 2),
        'target': round(target, 2),
        'risk_reward': rr_ratio,
        'factors': factors
    }
