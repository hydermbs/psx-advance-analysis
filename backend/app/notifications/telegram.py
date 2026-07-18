import os
import logging
import httpx
from app.notifications.base import BaseNotificationProvider

logger = logging.getLogger(__name__)

class TelegramNotificationProvider(BaseNotificationProvider):
    def __init__(self):
        self.bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.chat_id = os.getenv("TELEGRAM_CHAT_ID")
        self.api_url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage" if self.bot_token else None

    async def send(self, symbol: str, title: str, message: str) -> bool:
        if not self.bot_token or not self.chat_id:
            logger.debug("Telegram notifications are not configured (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID)")
            return False
        
        payload = {
            "chat_id": self.chat_id,
            "text": f"<b>{title}</b>\n{message}",
            "parse_mode": "HTML"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(self.api_url, json=payload, timeout=5.0)
                if response.status_code == 200:
                    return True
                logger.error(f"Telegram API error {response.status_code}: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Failed to send Telegram alert: {str(e)}")
            return False
