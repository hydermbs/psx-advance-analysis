from app.data.adapter import BaseDataAdapter
from app.data.psx import PSXDataAdapter
import os

class DataAdapterRegistry:
    def __init__(self):
        self._adapters = {
            'PSX': PSXDataAdapter()
        }
        # Default exchange
        self._active_exchange = os.getenv('ACTIVE_EXCHANGE', 'PSX')

    def get_adapter(self, exchange: str = None) -> BaseDataAdapter:
        exchange_name = exchange or self._active_exchange
        adapter = self._adapters.get(exchange_name.upper())
        if not adapter:
            raise ValueError(f"No adapter registered for exchange: {exchange_name}")
        return adapter

    def register_adapter(self, name: str, adapter: BaseDataAdapter):
        self._adapters[name.upper()] = adapter

# Singleton registry instance
registry = DataAdapterRegistry()

def get_data_adapter() -> BaseDataAdapter:
    return registry.get_adapter()
