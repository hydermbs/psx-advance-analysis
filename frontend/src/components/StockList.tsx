import React, { useState } from 'react';

interface StockInfo {
  symbol: string;
  name: string;
  sector: string;
  is_etf: boolean;
  exchange: string;
}

interface StockListProps {
  stocks: StockInfo[];
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
}

export const StockList: React.FC<StockListProps> = ({ stocks, selectedSymbol, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('All');

  // Filter stocks by search and sector
  const filteredStocks = stocks.filter((stock) => {
    const matchesSearch = 
      stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stock.name.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesSector = selectedSector === 'All' || stock.sector === selectedSector;
    
    return matchesSearch && matchesSector;
  });

  // Extract unique sectors
  const sectors = ['All', ...Array.from(new Set(stocks.map((s) => s.sector).filter(Boolean)))];

  return (
    <div className="glass-panel p-5 flex flex-col gap-4 h-full" style={{ maxHeight: 'calc(100vh - 100px)' }}>
      {/* Title */}
      <div className="flex items-center gap-2 pb-3 border-b border-outline-variant">
        <span className="material-symbols-outlined text-primary text-[22px]">list_alt</span>
        <h2 className="text-base font-bold tracking-tight text-on-surface">Market Assets</h2>
        <span className="ml-auto text-[11px] bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full font-bold">
          {filteredStocks.length}
        </span>
      </div>

      {/* Search Input */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
        <input
          type="text"
          aria-label="Search assets by symbol or name"
          placeholder="Search symbol or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-surface-container border border-outline-variant rounded-full py-2 pl-9 pr-4 text-xs text-on-surface placeholder-on-surface-variant/60 focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Sectors Horizontal Bar */}
      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-thin text-[10px] custom-scrollbar">
        {sectors.slice(0, 8).map((sector) => (
          <button
            key={sector}
            onClick={() => setSelectedSector(sector)}
            className={`px-2.5 py-1 rounded-full border transition-all whitespace-nowrap cursor-pointer ${
              selectedSector === sector
                ? 'bg-primary text-on-primary border-primary font-semibold'
                : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            {sector}
          </button>
        ))}
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1 custom-scrollbar">
        {filteredStocks.length > 0 ? (
          filteredStocks.map((stock) => (
            <button
              key={stock.symbol}
              onClick={() => onSelect(stock.symbol)}
              className={`w-full text-left p-2 rounded-lg transition-all flex items-center justify-between group cursor-pointer active:scale-[0.98] ${
                selectedSymbol === stock.symbol
                  ? 'bg-surface-container-high border-l-4 border-l-primary'
                  : 'bg-transparent border-l-4 border-l-transparent hover:bg-surface-container'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-surface-container-high rounded flex items-center justify-center font-bold text-[11px] text-on-surface-variant">
                  {stock.symbol.slice(0, 3)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-bold text-on-surface group-hover:text-primary transition-colors">
                      {stock.symbol}
                    </span>
                    {stock.is_etf && (
                      <span className="text-[9px] bg-primary-container text-on-primary-container px-1 py-0.5 rounded font-bold uppercase">
                        ETF
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center">
                <span className="text-[10px] text-on-surface-variant font-medium bg-surface-container px-2 py-0.5 rounded">
                  {stock.exchange}
                </span>
                <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-primary text-[18px] ml-1 transition-all">
                  chevron_right
                </span>
              </div>
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[32px] text-outline mb-2">find_in_page</span>
            <p className="text-xs font-semibold">No assets found</p>
            <p className="text-[10px] text-outline mt-0.5">Try refining your search</p>
          </div>
        )}
      </div>
    </div>
  );
};
