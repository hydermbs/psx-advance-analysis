import os
import logging
import httpx
from app.notifications.base import BaseNotificationProvider

logger = logging.getLogger(__name__)

class DiscordNotificationProvider(BaseNotificationProvider):
    def __init__(self):
        self.webhook_url = os.getenv("DISCORD_WEBHOOK_URL")

    async def send(self, symbol: str, title: str, message: str) -> bool:
        if not self.webhook_url:
            logger.debug("Discord notifications are not configured (missing DISCORD_WEBHOOK_URL)")
            return False

        # Convert HTML tags used in Telegram to Discord Markdown
        message_markdown = (
            message.replace("<b>", "**")
            .replace("</b>", "**")
            .replace("<br>", "\n")
            .replace("<br/>", "\n")
        )

        # Color coding based on title indicators
        color = 9807270  # Default Slate/Gray
        if "STOP LOSS" in title or "SELL" in title:
            color = 15273766  # Red/Rose
        elif "TARGET" in title or "BUY" in title:
            color = 30030  # Emerald Green

        payload = {
            "embeds": [
                {
                    "title": title,
                    "description": message_markdown,
                    "color": color
                }
            ]
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(self.webhook_url, json=payload, timeout=5.0)
                if response.status_code in [200, 204]:
                    return True
                logger.error(f"Discord Webhook error {response.status_code}: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Failed to send Discord webhook: {str(e)}")
            return False
