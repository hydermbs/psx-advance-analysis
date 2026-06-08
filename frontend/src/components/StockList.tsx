import React, { useState } from 'react';
import { Search, Flame, Compass, ChevronRight } from 'lucide-react';

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
    <div className="glass-panel p-4 flex flex-col gap-4 h-full" style={{ maxHeight: 'calc(100vh - 100px)' }}>
      {/* Title */}
      <div className="flex items-center gap-2 pb-2 border-b border-[rgba(255,255,255,0.06)]">
        <Flame className="text-orange-500 w-5 h-5" />
        <h2 className="text-lg font-bold tracking-tight">Market Assets</h2>
        <span className="ml-auto text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-medium">
          {filteredStocks.length} listed
        </span>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 text-slate-500 w-4 h-4" />
        <input
          type="text"
          aria-label="Search assets by symbol or name"
          placeholder="Search symbol or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#0b0f19] border border-[rgba(255,255,255,0.08)] rounded-lg py-2 pl-9 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
        />
      </div>

      {/* Sectors Horizontal Bar */}
      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-thin text-[10px]">
        {sectors.slice(0, 8).map((sector) => (
          <button
            key={sector}
            onClick={() => setSelectedSector(sector)}
            className={`px-2.5 py-1 rounded-full border transition-all whitespace-nowrap ${
              selectedSector === sector
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 font-semibold'
                : 'bg-[#0b0f19]/60 border-[rgba(255,255,255,0.05)] text-slate-400 hover:text-slate-200'
            }`}
          >
            {sector}
          </button>
        ))}
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 scrollbar-thin">
        {filteredStocks.length > 0 ? (
          filteredStocks.map((stock) => (
            <button
              key={stock.symbol}
              onClick={() => onSelect(stock.symbol)}
              className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between group ${
                selectedSymbol === stock.symbol
                  ? 'bg-blue-950/20 border-blue-500/40 shadow-sm shadow-blue-900/10'
                  : 'bg-transparent border-transparent hover:bg-slate-800/25'
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                    {stock.symbol}
                  </span>
                  {stock.is_etf && (
                    <span className="text-[9px] bg-indigo-950/40 text-indigo-400 border border-indigo-800/40 px-1 py-0.5 rounded font-semibold">
                      ETF
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400 truncate max-w-[160px]">
                  {stock.name}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[160px]">
                  {stock.sector}
                </span>
              </div>
              
              <ChevronRight className={`w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-all ${
                selectedSymbol === stock.symbol ? 'translate-x-0.5 text-blue-400' : 'group-hover:translate-x-0.5'
              }`} />
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
            <Compass className="w-8 h-8 mb-2 text-slate-600 animate-pulse" />
            <p className="text-xs font-semibold">No assets found</p>
            <p className="text-[10px] text-slate-600 mt-0.5">Try refining your search</p>
          </div>
        )}
      </div>
    </div>
  );
};
