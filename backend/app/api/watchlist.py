import asyncio
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select
from app.database import get_db_session
from app.models.watchlist import WatchlistItem, NotificationLog
from app.data.registry import get_data_adapter
from app.analysis.pipeline import run_analysis_pipeline

router = APIRouter(prefix="/api/v1/watchlist", tags=["watchlist"])

class WatchlistCreate(BaseModel):
    symbol: str
    purchase_price: Optional[float] = None
    quantity: Optional[int] = None
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    alert_on_signal: bool = True

class WatchlistUpdate(BaseModel):
    purchase_price: Optional[float] = None
    quantity: Optional[int] = None
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    alert_on_signal: Optional[bool] = None

async def fetch_item_details(item: WatchlistItem):
    symbol = item.symbol
    details = {
        "id": item.id,
        "symbol": symbol,
        "purchase_price": item.purchase_price,
        "quantity": item.quantity,
        "target_price": item.target_price,
        "stop_loss": item.stop_loss,
        "is_custom_target": item.target_price is not None,
        "is_custom_stop_loss": item.stop_loss is not None,
        "alert_on_signal": item.alert_on_signal,
        "created_at": item.created_at,
        "current_price": None,
        "signal": "HOLD",
        "confidence": 0.0,
        "pnl_percent": None,
        "error": None
    }
    
    try:
        adapter = get_data_adapter()
        df = await adapter.get_ohlcv(symbol, "1d")
        if df.empty:
            details["error"] = "No market data found"
            return details
            
        analysis = run_analysis_pipeline(df, min_bars=20)
        if analysis.get("status") == "error":
            details["error"] = analysis.get("message")
            return details
            
        current_price = float(df["close"].iloc[-1])
        try:
            df_int = await adapter.get_ohlcv(symbol, "int")
            if not df_int.empty:
                current_price = float(df_int["close"].iloc[-1])
        except Exception:
            pass
            
        signals = analysis.get("signals", {})
        
        details["current_price"] = current_price
        details["signal"] = signals.get("signal", "HOLD")
        details["confidence"] = signals.get("confidence", 0.0)
        
        # Auto calculated levels fallback if custom is not set
        if item.target_price is None:
            details["target_price"] = signals.get("target")
        if item.stop_loss is None:
            details["stop_loss"] = signals.get("stop_loss")
            
        if item.purchase_price and item.purchase_price > 0:
            details["pnl_percent"] = ((current_price - item.purchase_price) / item.purchase_price) * 100
            
    except Exception as e:
        details["error"] = str(e)
        
    return details

@router.get("")
async def get_watchlist(db: Session = Depends(get_db_session)):
    statement = select(WatchlistItem)
    items = db.exec(statement).all()
    
    if not items:
        return []
        
    tasks = [fetch_item_details(item) for item in items]
    results = await asyncio.gather(*tasks)
    return results

@router.post("", status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(payload: WatchlistCreate, db: Session = Depends(get_db_session)):
    statement = select(WatchlistItem).where(WatchlistItem.symbol == payload.symbol.upper())
    existing = db.exec(statement).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Symbol '{payload.symbol}' is already in your watchlist."
        )
        
    try:
        adapter = get_data_adapter()
        symbols = await adapter.get_symbols()
        valid_symbols = {s["symbol"].upper() for s in symbols} if symbols else set()
        
        if valid_symbols and payload.symbol.upper() not in valid_symbols:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Symbol '{payload.symbol}' is not a valid exchange ticker."
            )
    except Exception:
        pass

    new_item = WatchlistItem(
        symbol=payload.symbol.upper(),
        purchase_price=payload.purchase_price,
        quantity=payload.quantity,
        target_price=payload.target_price,
        stop_loss=payload.stop_loss,
        alert_on_signal=payload.alert_on_signal
    )
    
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@router.put("/{symbol}")
async def update_watchlist_item(symbol: str, payload: WatchlistUpdate, db: Session = Depends(get_db_session)):
    statement = select(WatchlistItem).where(WatchlistItem.symbol == symbol.upper())
    item = db.exec(statement).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Watchlist item with symbol '{symbol}' not found."
        )
        
    update_data = payload.dict(exclude_unset=True)
    if "purchase_price" in update_data:
        item.purchase_price = update_data["purchase_price"]
    if "quantity" in update_data:
        item.quantity = update_data["quantity"]
    if "target_price" in update_data:
        item.target_price = update_data["target_price"]
    if "stop_loss" in update_data:
        item.stop_loss = update_data["stop_loss"]
    if "alert_on_signal" in update_data:
        item.alert_on_signal = update_data["alert_on_signal"]
        
    item.updated_at = datetime.now(timezone.utc)
    
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{symbol}")
async def delete_watchlist_item(symbol: str, db: Session = Depends(get_db_session)):
    statement = select(WatchlistItem).where(WatchlistItem.symbol == symbol.upper())
    item = db.exec(statement).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Watchlist item with symbol '{symbol}' not found."
        )
        
    db.delete(item)
    db.commit()
    return {"detail": f"Removed '{symbol}' from watchlist."}

@router.get("/logs", response_model=List[NotificationLog])
async def get_notification_logs(limit: int = 50, db: Session = Depends(get_db_session)):
    statement = select(NotificationLog).order_by(NotificationLog.created_at.desc()).limit(limit)
    logs = db.exec(statement).all()
    return logs
