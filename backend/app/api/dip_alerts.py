import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select
from app.database import get_db_session
from app.models.watchlist import DipAlert, NotificationLog
from app.data.registry import get_data_adapter
from app.analysis.pipeline import run_analysis_pipeline

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/dip-alerts", tags=["dip-alerts"])

class DipAlertCreate(BaseModel):
    symbol: str
    quantity: int = Field(gt=0)
    sell_price: float = Field(gt=0)
    target_type: str = Field(pattern="^(percentage|custom|technical)$")
    dip_percentage: Optional[float] = Field(default=None, ge=0, le=100)
    target_price: Optional[float] = Field(default=None, ge=0)

class DipAlertUpdate(BaseModel):
    quantity: Optional[int] = Field(default=None, gt=0)
    sell_price: Optional[float] = Field(default=None, gt=0)
    target_type: Optional[str] = Field(default=None, pattern="^(percentage|custom|technical)$")
    dip_percentage: Optional[float] = Field(default=None, ge=0, le=100)
    target_price: Optional[float] = Field(default=None, ge=0)
    is_active: Optional[bool] = None

async def calculate_target_reentry_price(
    symbol: str, 
    sell_price: float, 
    target_type: str, 
    dip_percentage: Optional[float], 
    custom_target: Optional[float]
) -> float:
    if target_type == "percentage":
        if dip_percentage is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="dip_percentage is required when target_type is 'percentage'"
            )
        return sell_price * (1 - dip_percentage / 100.0)
        
    elif target_type == "custom":
        if custom_target is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="target_price is required when target_type is 'custom'"
            )
        if custom_target >= sell_price:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target price must be lower than the sell price."
            )
        return custom_target
        
    elif target_type == "technical":
        try:
            adapter = get_data_adapter()
            df = await adapter.get_ohlcv(symbol, "1d")
            if df.empty:
                return sell_price * 0.95  # Fallback to 5% dip
                
            analysis = run_analysis_pipeline(df, min_bars=20)
            if analysis.get("status") == "error":
                return sell_price * 0.95
                
            # Extract technical levels
            signals = analysis.get("signals", {})
            bb_lower = None
            sma_50 = None
            recent_low = None
            
            # Read last row of indicators
            last_record = analysis.get("symbol_data", [])[-1] if analysis.get("symbol_data") else {}
            if "bb_lower" in last_record:
                bb_lower = last_record["bb_lower"]
            if "sma_50" in last_record:
                sma_50 = last_record["sma_50"]
            
            if not df.empty and len(df) >= 5:
                recent_low = float(df["low"].iloc[-5:].min())
                
            # Pick a support level strictly lower than the sell price
            candidates = []
            if bb_lower and bb_lower < sell_price:
                candidates.append(bb_lower)
            if sma_50 and sma_50 < sell_price:
                candidates.append(sma_50)
            if recent_low and recent_low < sell_price:
                candidates.append(recent_low)
                
            if candidates:
                # Pick the highest candidate that is below the sell price
                # (closest support to the current/sell price)
                return max(candidates)
                
            # Default fallback if no technical candidates are below sell price
            return sell_price * 0.95
        except Exception as e:
            logger.error(f"Error calculating technical target for {symbol}: {e}")
            return sell_price * 0.95
            
    return sell_price * 0.95

async def enrich_dip_alert(alert: DipAlert):
    details = {
        "id": alert.id,
        "symbol": alert.symbol,
        "quantity": alert.quantity,
        "sell_price": alert.sell_price,
        "target_type": alert.target_type,
        "dip_percentage": alert.dip_percentage,
        "target_price": alert.target_price,
        "is_active": alert.is_active,
        "is_triggered": alert.is_triggered,
        "triggered_price": alert.triggered_price,
        "triggered_at": alert.triggered_at,
        "created_at": alert.created_at,
        "current_price": None,
        "progress_percent": 0.0,
        "potential_savings": 0.0,
        "error": None
    }
    
    if not alert.is_active:
        # For triggered/inactive alerts, use historical triggered values
        current = alert.triggered_price or alert.target_price
        details["current_price"] = current
        details["progress_percent"] = 100.0
        details["potential_savings"] = (alert.sell_price - current) * alert.quantity
        return details
        
    try:
        adapter = get_data_adapter()
        # Fetch current price (try intraday first, then daily)
        current_price = None
        df = await adapter.get_ohlcv(alert.symbol, "1d")
        if not df.empty:
            current_price = float(df["close"].iloc[-1])
            
        try:
            df_int = await adapter.get_ohlcv(alert.symbol, "int")
            if not df_int.empty:
                current_price = float(df_int["close"].iloc[-1])
        except Exception:
            pass
            
        if current_price is None:
            details["error"] = "Failed to fetch market price"
            return details
            
        details["current_price"] = current_price
        
        # Calculate progress towards target
        if current_price >= alert.sell_price:
            progress = 0.0
        elif current_price <= alert.target_price:
            progress = 100.0
        else:
            total_range = alert.sell_price - alert.target_price
            if total_range > 0:
                progress = ((alert.sell_price - current_price) / total_range) * 100.0
            else:
                progress = 0.0
                
        details["progress_percent"] = round(min(100.0, max(0.0, progress)), 1)
        details["potential_savings"] = round((alert.sell_price - current_price) * alert.quantity, 2)
        
    except Exception as e:
        details["error"] = str(e)
        
    return details

@router.get("", response_model=List[dict])
async def get_dip_alerts(db: Session = Depends(get_db_session)):
    statement = select(DipAlert).order_by(DipAlert.is_active.desc(), DipAlert.created_at.desc())
    alerts = db.exec(statement).all()
    
    if not alerts:
        return []
        
    tasks = [enrich_dip_alert(alert) for alert in alerts]
    results = await asyncio.gather(*tasks)
    return results

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_dip_alert(payload: DipAlertCreate, db: Session = Depends(get_db_session)):
    # Validate symbol uppercase
    symbol = payload.symbol.upper()
    
    try:
        adapter = get_data_adapter()
        symbols = await adapter.get_symbols()
        valid_symbols = {s["symbol"].upper() for s in symbols} if symbols else set()
        
        if valid_symbols and symbol not in valid_symbols:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Symbol '{payload.symbol}' is not a valid exchange ticker."
            )
    except HTTPException as he:
        raise he
    except Exception:
        pass
        
    target_price = await calculate_target_reentry_price(
        symbol=symbol,
        sell_price=payload.sell_price,
        target_type=payload.target_type,
        dip_percentage=payload.dip_percentage,
        custom_target=payload.target_price
    )
    
    # Round target price to 2 decimal places
    target_price = round(target_price, 2)
    
    new_alert = DipAlert(
        symbol=symbol,
        quantity=payload.quantity,
        sell_price=payload.sell_price,
        target_type=payload.target_type,
        dip_percentage=payload.dip_percentage,
        target_price=target_price,
        is_active=True,
        is_triggered=False
    )
    
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)
    return new_alert

@router.put("/{id}")
async def update_dip_alert(id: int, payload: DipAlertUpdate, db: Session = Depends(get_db_session)):
    statement = select(DipAlert).where(DipAlert.id == id)
    alert = db.exec(statement).first()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dip alert with id {id} not found."
        )
        
    update_data = payload.dict(exclude_unset=True)
    
    # Detect if we need to recalculate target price
    recalc_target = False
    
    if "quantity" in update_data:
        alert.quantity = update_data["quantity"]
    if "is_active" in update_data:
        alert.is_active = update_data["is_active"]
        if alert.is_active:
            alert.is_triggered = False
            alert.triggered_price = None
            alert.triggered_at = None
            
    if "sell_price" in update_data:
        alert.sell_price = update_data["sell_price"]
        recalc_target = True
    if "target_type" in update_data:
        alert.target_type = update_data["target_type"]
        recalc_target = True
    if "dip_percentage" in update_data:
        alert.dip_percentage = update_data["dip_percentage"]
        recalc_target = True
    if "target_price" in update_data:
        # If user explicitly updates custom target_price
        alert.target_price = update_data["target_price"]
        recalc_target = False  # Explicit override
        
    if recalc_target:
        new_target = await calculate_target_reentry_price(
            symbol=alert.symbol,
            sell_price=alert.sell_price,
            target_type=alert.target_type,
            dip_percentage=alert.dip_percentage,
            custom_target=update_data.get("target_price")
        )
        alert.target_price = round(new_target, 2)
        
    alert.updated_at = datetime.now(timezone.utc)
    
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert

@router.delete("/{id}")
async def delete_dip_alert(id: int, db: Session = Depends(get_db_session)):
    statement = select(DipAlert).where(DipAlert.id == id)
    alert = db.exec(statement).first()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dip alert with id {id} not found."
        )
        
    db.delete(alert)
    db.commit()
    return {"detail": f"Deleted dip alert for {alert.symbol}."}
