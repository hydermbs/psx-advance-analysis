import logging
from datetime import datetime, timezone
from sqlmodel import Session, select
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.database import engine
from app.models.watchlist import WatchlistItem, NotificationLog, DipAlert
from app.data.registry import get_data_adapter
from app.analysis.pipeline import run_analysis_pipeline
from app.notifications.manager import notification_manager

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

async def check_watchlist_prices():
    logger.info("Executing background watchlist price check...")
    
    with Session(engine) as session:
        statement = select(WatchlistItem)
        items = session.exec(statement).all()
        
        if not items:
            logger.info("Watchlist is empty. No symbols to monitor.")
            return

        adapter = get_data_adapter()
        
        for item in items:
            symbol = item.symbol
            try:
                df = await adapter.get_ohlcv(symbol, "1d")
                if df.empty:
                    logger.warning(f"No market data returned for symbol {symbol} in scheduler.")
                    continue
                
                analysis = run_analysis_pipeline(df, min_bars=20)
                if analysis.get("status") == "error":
                    logger.warning(f"Pipeline error for {symbol} in scheduler: {analysis.get('message')}")
                    continue
                
                signals = analysis.get("signals", {})
                current_price = float(df["close"].iloc[-1])
                try:
                    df_int = await adapter.get_ohlcv(symbol, "int")
                    if not df_int.empty:
                        current_price = float(df_int["close"].iloc[-1])
                except Exception as e:
                    logger.warning(f"Failed to fetch intraday price for {symbol} in scheduler: {e}")
                    
                signal_verdict = signals.get("signal", "HOLD")
                
                # 1. Signal Change Alert
                if item.alert_on_signal and item.last_notified_signal != signal_verdict:
                    title = f"🚨 SIGNAL ALERT: {symbol}"
                    msg = (
                        f"Technical signal for <b>{symbol}</b> changed from "
                        f"<b>{item.last_notified_signal or 'NONE'}</b> to <b>{signal_verdict}</b>.\n"
                        f"Current Price: PKR {current_price:.2f}\n"
                        f"Confidence: {signals.get('confidence', 0.0)}%\n"
                        f"Target: PKR {signals.get('target', 0.0):.2f} | Stop Loss: PKR {signals.get('stop_loss', 0.0):.2f}"
                    )
                    
                    item.last_notified_signal = signal_verdict
                    item.updated_at = datetime.now(timezone.utc)
                    session.add(item)
                    
                    log = NotificationLog(
                        symbol=symbol,
                        alert_type="SIGNAL_CHANGE",
                        message=msg,
                        triggered_price=current_price
                    )
                    session.add(log)
                    await notification_manager.dispatch(symbol, title, msg)
                
                is_short = signal_verdict in ["SELL", "STRONG_SELL"]
                tp_level = item.target_price if item.target_price is not None else signals.get("target")
                sl_level = item.stop_loss if item.stop_loss is not None else signals.get("stop_loss")
                
                # 2. Stop Loss Alert Evaluation
                sl_triggered = False
                if sl_level is not None:
                    sl_triggered = (current_price >= sl_level) if is_short else (current_price <= sl_level)
                
                if sl_triggered:
                    if item.last_notified_stop_loss != sl_level:
                        title = f"⚠️ STOP LOSS TRIGGERED: {symbol}"
                        msg = (
                            f"<b>{symbol}</b> has hit the Stop Loss threshold of PKR {sl_level:.2f}.\n"
                            f"Current Price: PKR {current_price:.2f}\n"
                            f"Verdict: {signal_verdict}"
                        )
                        
                        item.last_notified_stop_loss = sl_level
                        item.updated_at = datetime.now(timezone.utc)
                        session.add(item)
                        
                        log = NotificationLog(
                            symbol=symbol,
                            alert_type="STOP_LOSS",
                            message=msg,
                            triggered_price=current_price
                        )
                        session.add(log)
                        await notification_manager.dispatch(symbol, title, msg)
                else:
                    if item.last_notified_stop_loss is not None:
                        item.last_notified_stop_loss = None
                        item.updated_at = datetime.now(timezone.utc)
                        session.add(item)
                
                # 3. Target Price Alert Evaluation
                tp_triggered = False
                if tp_level is not None:
                    tp_triggered = (current_price <= tp_level) if is_short else (current_price >= tp_level)
                
                if tp_triggered:
                    if item.last_notified_target != tp_level:
                        title = f"🎯 TARGET REACHED: {symbol}"
                        msg = (
                            f"<b>{symbol}</b> has hit the Target Price threshold of PKR {tp_level:.2f}.\n"
                            f"Current Price: PKR {current_price:.2f}\n"
                            f"Verdict: {signal_verdict}"
                        )
                        
                        item.last_notified_target = tp_level
                        item.updated_at = datetime.now(timezone.utc)
                        session.add(item)
                        
                        log = NotificationLog(
                            symbol=symbol,
                            alert_type="TARGET_PRICE",
                            message=msg,
                            triggered_price=current_price
                        )
                        session.add(log)
                        await notification_manager.dispatch(symbol, title, msg)
                else:
                    if item.last_notified_target is not None:
                        item.last_notified_target = None
                        item.updated_at = datetime.now(timezone.utc)
                        session.add(item)
                
                session.commit()
                
            except Exception as e:
                logger.error(f"Error checking price for symbol {symbol} in background scheduler: {str(e)}")

async def check_dip_alerts():
    logger.info("Executing background dip alerts check...")
    
    with Session(engine) as session:
        statement = select(DipAlert).where(DipAlert.is_active == True)
        alerts = session.exec(statement).all()
        
        if not alerts:
            logger.info("No active dip alerts to monitor.")
            return
            
        adapter = get_data_adapter()
        
        for alert in alerts:
            symbol = alert.symbol
            try:
                current_price = None
                df = await adapter.get_ohlcv(symbol, "1d")
                if not df.empty:
                    current_price = float(df["close"].iloc[-1])
                
                try:
                    df_int = await adapter.get_ohlcv(symbol, "int")
                    if not df_int.empty:
                        current_price = float(df_int["close"].iloc[-1])
                except Exception:
                    pass
                    
                if current_price is None:
                    logger.warning(f"Could not fetch current price for {symbol} in dip check.")
                    continue
                    
                if current_price <= alert.target_price:
                    total_sell_value = alert.quantity * alert.sell_price
                    reentry_cost = alert.quantity * current_price
                    savings = total_sell_value - reentry_cost
                    percentage_drop = ((alert.sell_price - current_price) / alert.sell_price) * 100.0
                    
                    title = f"📉 DIP RE-ENTRY TRIGGERED: {symbol}"
                    msg = (
                        f"You sold {alert.quantity} shares of <b>{symbol}</b> at PKR {alert.sell_price:.2f}.\n"
                        f"Price has dipped to <b>PKR {current_price:.2f}</b> (Target: PKR {alert.target_price:.2f}, -{percentage_drop:.1f}%).\n"
                        f"Re-entry Cost: PKR {reentry_cost:.2f} | <b>Total Savings: PKR {savings:.2f}</b>!"
                    )
                    
                    alert.is_active = False
                    alert.is_triggered = True
                    alert.triggered_price = current_price
                    alert.triggered_at = datetime.now(timezone.utc)
                    alert.updated_at = datetime.now(timezone.utc)
                    session.add(alert)
                    
                    log = NotificationLog(
                        symbol=symbol,
                        alert_type="DIP_ALERT",
                        message=msg,
                        triggered_price=current_price
                    )
                    session.add(log)
                    
                    await notification_manager.dispatch(symbol, title, msg)
                    logger.info(f"Dip alert triggered for {symbol}: price={current_price}, target={alert.target_price}")
                    
            except Exception as e:
                logger.error(f"Error checking dip alert for symbol {symbol}: {str(e)}")
                
        session.commit()

def start_scheduler():
    scheduler.add_job(
        check_watchlist_prices,
        "interval",
        minutes=15,
        id="watchlist_price_check",
        replace_existing=True
    )
    scheduler.add_job(
        check_dip_alerts,
        "interval",
        minutes=15,
        id="dip_alerts_check",
        replace_existing=True
    )
    scheduler.start()
    logger.info("Background price scheduler started successfully.")

def shutdown_scheduler():
    scheduler.shutdown()
    logger.info("Background price scheduler stopped.")
