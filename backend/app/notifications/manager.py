import logging
from typing import List
from app.notifications.base import BaseNotificationProvider
from app.notifications.telegram import TelegramNotificationProvider
from app.notifications.discord import DiscordNotificationProvider

logger = logging.getLogger(__name__)

class NotificationManager:
    def __init__(self):
        self.providers: List[BaseNotificationProvider] = [
            TelegramNotificationProvider(),
            DiscordNotificationProvider()
        ]

    async def dispatch(self, symbol: str, title: str, message: str) -> None:
        for provider in self.providers:
            try:
                await provider.send(symbol, title, message)
            except Exception as e:
                logger.error(f"Error dispatching notification via {provider.__class__.__name__}: {str(e)}")

notification_manager = NotificationManager()
