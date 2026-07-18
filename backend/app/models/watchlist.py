from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class WatchlistItem(SQLModel, table=True):
    __tablename__: str = "watchlist_items"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str = Field(unique=True, index=True, nullable=False)
    purchase_price: Optional[float] = Field(default=None)
    target_price: Optional[float] = Field(default=None)
    stop_loss: Optional[float] = Field(default=None)
    alert_on_signal: bool = Field(default=True)
    last_notified_signal: Optional[str] = Field(default=None)
    last_notified_stop_loss: Optional[float] = Field(default=None)
    last_notified_target: Optional[float] = Field(default=None)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

class NotificationLog(SQLModel, table=True):
    __tablename__: str = "notification_logs"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str = Field(index=True, nullable=False)
    alert_type: str = Field(nullable=False)
    message: str = Field(nullable=False)
    triggered_price: float = Field(nullable=False)
    created_at: datetime = Field(default_factory=utc_now)
