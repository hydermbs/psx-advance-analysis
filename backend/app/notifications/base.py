from abc import ABC, abstractmethod

class BaseNotificationProvider(ABC):
    @abstractmethod
    async def send(self, symbol: str, title: str, message: str) -> bool:
        pass
