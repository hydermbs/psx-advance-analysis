import React, { useState, useEffect, useRef } from 'react';

interface StockInfo {
  symbol: string;
  name: string;
  sector: string;
  is_etf: boolean;
  exchange: string;
}

interface WatchlistItem {
  id: number;
  symbol: string;
  purchase_price: number | null;
  quantity: number | null;
  target_price: number | null;
  stop_loss: number | null;
  is_custom_target: boolean;
  is_custom_stop_loss: boolean;
  alert_on_signal: boolean;
  current_price: number | null;
  signal: string;
  confidence: number;
  pnl_percent: number | null;
  error: string | null;
}

interface AlertLog {
  id: number;
  symbol: string;
  alert_type: string;
  message: string;
  triggered_price: number;
  created_at: string;
}

interface WatchlistDashboardProps {
  stocks: StockInfo[];
  onSelectSymbol: (symbol: string) => void;
}

/** Safely render log messages that may contain only <b> tags from the backend. */
function renderSafeMessage(message: string): React.ReactNode {
  const parts = message.split(/(<\/?b>)/gi);
  let bold = false;
  return parts.map((part, i) => {
    if (part.toLowerCase() === '<b>') { bold = true; return null; }
    if (part.toLowerCase() === '</b>') { bold = false; return null; }
    return bold ? <b key={i}>{part}</b> : <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export const WatchlistDashboard: React.FC<WatchlistDashboardProps> = ({ stocks, onSelectSymbol }) => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchVal, setSearchVal] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const [editingItem, setEditingItem] = useState<WatchlistItem | null>(null);
  const [costInput, setCostInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('');
  const [slInput, setSlInput] = useState('');
  const [tpInput, setTpInput] = useState('');
  const [alertOnSignal, setAlertOnSignal] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Symbol awaiting delete confirmation
  const [confirmDeleteSymbol, setConfirmDeleteSymbol] = useState<string | null>(null);

  // Refs for focus management
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);
  const editModalRef = useRef<HTMLDivElement | null>(null);
  const confirmModalRef = useRef<HTMLDivElement | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);

  const fetchWatchlist = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/watchlist');
      if (!res.ok) throw new Error('Failed to fetch watchlist');
      const data = await res.json();
      setWatchlist(data);
    } catch (err: any) {
      console.error(err);
      setError('Could not load watchlist data');
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/watchlist/logs');
      if (!res.ok) throw new Error('Failed to fetch notification logs');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load alert logs:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchWatchlist(), fetchLogs()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      fetchWatchlist();
      fetchLogs();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close modals on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingItem) closeEditModal();
        else if (confirmDeleteSymbol) cancelDelete();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editingItem, confirmDeleteSymbol]);

  // Move focus into edit modal when it opens
  useEffect(() => {
    if (editingItem && editModalRef.current) {
      const first = editModalRef.current.querySelector<HTMLElement>('input, button');
      first?.focus();
    }
  }, [editingItem]);

  // Move focus into confirm modal when it opens
  useEffect(() => {
    if (confirmDeleteSymbol && confirmModalRef.current) {
      const cancelBtn = confirmModalRef.current.querySelector<HTMLElement>('button');
      cancelBtn?.focus();
    }
  }, [confirmDeleteSymbol]);

  const handleAddSymbol = async (symbol: string) => {
    try {
      setError(null);
      const res = await fetch('http://localhost:8000/api/v1/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to add symbol');
      }
      setSearchVal('');
      await fetchWatchlist();
    } catch (err: any) {
      setError(err.message || 'Failed to add symbol');
    }
  };

  const handleDeleteSymbol = (symbol: string, trigger: HTMLButtonElement) => {
    deleteTriggerRef.current = trigger;
    setConfirmDeleteSymbol(symbol);
  };

  const cancelDelete = () => {
    setConfirmDeleteSymbol(null);
    deleteTriggerRef.current?.focus();
  };

  const confirmDelete = async () => {
    if (!confirmDeleteSymbol) return;
    const symbol = confirmDeleteSymbol;
    setConfirmDeleteSymbol(null);
    deleteTriggerRef.current?.focus();
    try {
      const res = await fetch(`http://localhost:8000/api/v1/watchlist/${symbol}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to remove symbol');
      await fetchWatchlist();
    } catch (err: any) {
      setError(err.message || 'Failed to remove symbol');
    }
  };

  const openEditModal = (item: WatchlistItem, trigger: HTMLButtonElement) => {
    editTriggerRef.current = trigger;
    setEditingItem(item);
    setCostInput(item.purchase_price != null ? item.purchase_price.toString() : '');
    setQuantityInput(item.quantity != null ? item.quantity.toString() : '');
    setSlInput(item.is_custom_stop_loss && item.stop_loss != null ? item.stop_loss.toString() : '');
    setTpInput(item.is_custom_target && item.target_price != null ? item.target_price.toString() : '');
    setAlertOnSignal(item.alert_on_signal);
    setModalError(null);
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setQuantityInput('');
    setModalError(null);
    editTriggerRef.current?.focus();
  };

  const handleUpdateItem = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setUpdating(true);
    setModalError(null);
    try {
      const payload = {
        purchase_price: costInput.trim() !== '' ? parseFloat(costInput) : null,
        quantity: quantityInput.trim() !== '' ? parseInt(quantityInput, 10) : null,
        stop_loss: slInput.trim() !== '' ? parseFloat(slInput) : null,
        target_price: tpInput.trim() !== '' ? parseFloat(tpInput) : null,
        alert_on_signal: alertOnSignal
      };

      const res = await fetch(`http://localhost:8000/api/v1/watchlist/${editingItem.symbol}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to update alert levels');
      closeEditModal();
      await fetchWatchlist();
    } catch (err: any) {
      setModalError(err.message || 'Failed to update item');
    } finally {
      setUpdating(false);
    }
  };

  const getSignalBadge = (signal: string) => {
    const isBuy = signal.includes('BUY');
    const isSell = signal.includes('SELL');
    if (isBuy) {
      return (
        <span className="bg-secondary/15 text-secondary border border-secondary/20 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">
          {signal.replace('_', ' ')}
        </span>
      );
    }
    if (isSell) {
      return (
        <span className="bg-error/15 text-error border border-error/20 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">
          {signal.replace('_', ' ')}
        </span>
      );
    }
    return (
      <span className="bg-surface-container-high text-on-surface-variant border border-outline-variant px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">
        HOLD
      </span>
    );
  };

  // Summing up values for the top summary panel
  const summary = watchlist.reduce(
    (acc, item) => {
      if (item.purchase_price != null && item.quantity != null && item.quantity > 0) {
        const invested = item.purchase_price * item.quantity;
        const currentVal = (item.current_price ?? item.purchase_price) * item.quantity;
        acc.totalInvested += invested;
        acc.currentValue += currentVal;
      }
      return acc;
    },
    { totalInvested: 0, currentValue: 0 }
  );

  const totalPnL = summary.currentValue - summary.totalInvested;
  const totalPnLPercent = summary.totalInvested > 0 ? (totalPnL / summary.totalInvested) * 100 : 0;

  return (
    <div className="grid grid-cols-12 gap-6 w-full relative">
      {/* Top Banner Alert / Error */}
      {error && (
        <div
          role="alert"
          className="col-span-12 bg-error/10 border border-error/25 text-error rounded-xl p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">error</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="text-error/70 hover:text-error border-none bg-transparent cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
          </button>
        </div>
      )}

      {/* Top Summary Cards */}
      {watchlist.some(item => item.purchase_price != null && item.quantity != null && item.quantity > 0) && (
        <div style={{padding:'10px 10px 10px 10px'}} className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Total Invested */}
          <div style={{padding:'10px 10px 10px 10px'}} className="glass-panel p-4 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Total Invested</span>
                <span className="text-lg font-black text-on-surface tabular-nums">
                  PKR {summary.totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <span className="material-symbols-outlined text-[20px] text-primary bg-surface-container p-2 rounded-lg" aria-hidden="true">payments</span>
            </div>
          </div>

          {/* Card 2: Current Value */}
          <div style={{padding:'10px 10px 10px 10px'}} className="glass-panel p-4 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Current Value</span>
                <span className="text-lg font-black text-on-surface tabular-nums">
                  PKR {summary.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <span className="material-symbols-outlined text-[20px] text-primary bg-surface-container p-2 rounded-lg" aria-hidden="true">monitoring</span>
            </div>
          </div>

          {/* Card 3: Total Profit & Loss */}
          <div style={{padding:'10px 10px 10px 10px'}} className={`glass-panel p-4 flex flex-col justify-between border-l-4 ${totalPnL >= 0 ? 'border-l-secondary' : 'border-l-error'}`}>
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Total Profit / Loss</span>
                <span className={`text-lg font-black tabular-nums ${totalPnL >= 0 ? 'text-secondary' : 'text-error'}`}>
                  {totalPnL >= 0 ? '+' : ''}PKR {totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`text-[10px] font-extrabold mt-0.5 flex items-center gap-0.5 ${totalPnL >= 0 ? 'text-secondary' : 'text-error'}`}>
                  {totalPnL >= 0 ? '▲' : '▼'} {totalPnLPercent.toFixed(2)}%
                </span>
              </div>
              <span className={`material-symbols-outlined text-[20px] p-2 rounded-lg ${totalPnL >= 0 ? 'text-secondary bg-secondary/10' : 'text-error bg-error/10'}`} aria-hidden="true">
                {totalPnL >= 0 ? 'trending_up' : 'trending_down'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Watchlist Table Column */}
      <div style={{paddingTop:'10px'}} className="col-span-12 lg:col-span-8 flex flex-col gap-6">
        <div style= {{padding:'10px 10px 10px 10px'}} className="glass-panel p-5 flex flex-col gap-4">
          <div className="flex justify-between items-center shrink-0">
            <div>
              <h2 className="text-base font-extrabold text-primary uppercase">My Watchlist</h2>
              <p className="text-[10px] text-on-surface-variant font-bold tracking-wider uppercase">Stocks you are tracking for signals & target levels</p>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              aria-label="Refresh watchlist"
              aria-busy={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-outline-variant text-[10px] font-bold uppercase rounded-lg hover:bg-surface-container-high cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className={`material-symbols-outlined text-[14px] ${loading ? 'animate-spin' : ''}`} aria-hidden="true">sync</span>
              Refresh
            </button>
          </div>

          {loading && watchlist.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center min-h-[300px]" role="status" aria-label="Loading watchlist">
              <span className="material-symbols-outlined text-primary text-[32px] animate-spin mb-3" aria-hidden="true">sync</span>
              <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">Syncing Watchlist Indicators...</p>
            </div>
          ) : watchlist.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center min-h-[300px] border border-dashed border-outline-variant rounded-xl text-center">
              <span className="material-symbols-outlined text-on-surface-variant text-[44px] mb-3" aria-hidden="true">playlist_add</span>
              <h3 className="text-xs font-bold text-on-surface">Your watchlist is empty</h3>
              <p className="text-on-surface-variant text-[10px] mt-1 max-w-[280px]">Add stock symbols from the panel on the right to start tracking technical signals and price alerts.</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant font-bold text-[10px] uppercase tracking-wider">
                    <th className="pb-3 pl-2" scope="col">Asset</th>
                    <th className="pb-3 text-right" scope="col">Last Price</th>
                    <th className="pb-3 text-center" scope="col">Verdict</th>
                    <th className="pb-3 text-right" scope="col">Avg Cost</th>
                    <th className="pb-3 text-right" scope="col">Qty</th>
                    <th className="pb-3 text-right" scope="col">Invested</th>
                    <th className="pb-3 text-right" scope="col">P&L %</th>
                    <th className="pb-3 text-right" scope="col">P&L Amount</th>
                    <th className="pb-3 text-center" scope="col">Limits</th>
                    <th className="pb-3 text-center pr-2" scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50 tabular-nums">
                  {watchlist.map((item) => {
                    const price = item.current_price;
                    const changePercent = item.pnl_percent;
                    const isPositive = changePercent != null && changePercent >= 0;

                    const quantity = item.quantity;
                    const invested = (item.purchase_price != null && quantity != null) ? item.purchase_price * quantity : null;
                    const pnlAmount = (price != null && item.purchase_price != null && quantity != null) ? (price - item.purchase_price) * quantity : null;
                    const isPnLAmountPositive = pnlAmount != null && pnlAmount >= 0;

                    return (
                      <tr key={item.id} className="hover:bg-surface-container/30 transition-colors group">
                        <td className="py-3.5 pl-2">
                          <div className="flex flex-col">
                            <button
                              onClick={() => onSelectSymbol(item.symbol)}
                              className="text-left font-extrabold text-primary hover:text-secondary bg-transparent border-none p-0 cursor-pointer text-xs focus:outline-none focus:underline"
                            >
                              {item.symbol}
                            </button>
                            <span className="text-[10px] text-on-surface-variant font-medium truncate max-w-[150px]">
                              {stocks.find((s) => s.symbol === item.symbol)?.name || 'Tracked Asset'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 text-right font-semibold text-on-surface">
                          {price != null ? `PKR ${price.toFixed(2)}` : 'Loading...'}
                        </td>
                        <td className="py-3.5 text-center">
                          {item.error ? (
                            <span className="text-error font-semibold text-[9px] uppercase">Error</span>
                          ) : (
                            getSignalBadge(item.signal)
                          )}
                        </td>
                        <td className="py-3.5 text-right font-medium text-on-surface-variant">
                          {item.purchase_price != null ? `PKR ${item.purchase_price.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3.5 text-right font-medium text-on-surface-variant">
                          {quantity != null ? quantity.toLocaleString('en-US') : '—'}
                        </td>
                        <td className="py-3.5 text-right font-medium text-on-surface-variant">
                          {invested != null ? `PKR ${invested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className={`py-3.5 text-right font-bold ${
                          changePercent == null ? 'text-on-surface-variant' : isPositive ? 'text-secondary' : 'text-error'
                        }`}>
                          {changePercent != null ? (
                            <span>{isPositive ? '+' : ''}{changePercent.toFixed(2)}%</span>
                          ) : '—'}
                        </td>
                        <td className={`py-3.5 text-right font-bold ${
                          pnlAmount == null ? 'text-on-surface-variant' : isPnLAmountPositive ? 'text-secondary' : 'text-error'
                        }`}>
                          {pnlAmount != null ? (
                            <span>{isPnLAmountPositive ? '+' : ''}PKR {pnlAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          ) : '—'}
                        </td>
                        <td className="py-3.5 text-center">
                          <div className="flex flex-col items-center gap-0.5 text-[9px] font-bold text-on-surface-variant">
                            {item.stop_loss != null && (
                              <span className="text-error flex items-center gap-0.5" title={item.is_custom_stop_loss ? "Custom Stop Loss" : "Auto Stop Loss from Dashboard"}>
                                <span className="material-symbols-outlined text-[10px]" aria-hidden="true">trending_down</span>
                                SL: {item.stop_loss.toFixed(1)} {!item.is_custom_stop_loss && <span className="opacity-60 font-semibold text-[8px]">(auto)</span>}
                              </span>
                            )}
                            {item.target_price != null && (
                              <span className="text-secondary flex items-center gap-0.5" title={item.is_custom_target ? "Custom Target Price" : "Auto Target Price from Dashboard"}>
                                <span className="material-symbols-outlined text-[10px]" aria-hidden="true">trending_up</span>
                                TP: {item.target_price.toFixed(1)} {!item.is_custom_target && <span className="opacity-60 font-semibold text-[8px]">(auto)</span>}
                              </span>
                            )}
                            {item.stop_loss == null && item.target_price == null && (
                              <span className="opacity-40 font-medium">None set</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 text-center pr-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => openEditModal(item, e.currentTarget)}
                              aria-label={`Configure alerts for ${item.symbol}`}
                              className="w-9 h-9 flex items-center justify-center text-primary-fixed-dim hover:bg-surface-container-high rounded-full border-none bg-transparent cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">edit_notifications</span>
                            </button>
                            <button
                              onClick={(e) => handleDeleteSymbol(item.symbol, e.currentTarget)}
                              aria-label={`Remove ${item.symbol} from watchlist`}
                              className="w-9 h-9 flex items-center justify-center text-error hover:bg-error-container/20 rounded-full border-none bg-transparent cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-error/50"
                            >
                              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right Column Panels */}
      <div style= {{paddingTop:'10px'}}  className="col-span-12 lg:col-span-4 flex flex-col gap-6">
        {/* Add Ticker Card */}
        <section style={{padding: '10px 10px 10px 10px'}} className="glass-panel p-5 flex flex-col gap-3">
          <h3 className="text-xs font-extrabold text-primary uppercase">Add Stock Ticker</h3>
          <p className="text-[10px] text-on-surface-variant font-medium leading-relaxed">Enter a symbol or select from exchange suggestions below.</p>
      
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]" aria-hidden="true">add</span>
            <label htmlFor="ticker-search" className="sr-only">Search stock ticker</label>
            <input
              id="ticker-search"
              style={{ padding: '8px 8px 8px 32px' }}
              className="w-full bg-surface-container border border-outline-variant rounded-xl text-xs focus:outline-none focus:border-primary transition-colors p-[8px]"
              placeholder="Search ticker (e.g. HUBC, LUCK)"
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => {
                setTimeout(() => setSearchFocused(false), 200);
              }}
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={searchFocused}
            />

            {/* Auto-suggest dropdown */}
            {searchFocused && (
              (() => {
                const results = searchVal.trim() !== ''
                  ? stocks.filter(s =>
                      s.symbol.toUpperCase().includes(searchVal.toUpperCase()) ||
                      s.name.toUpperCase().includes(searchVal.toUpperCase())
                    )
                  : stocks.slice(0, 10);

                const activeSymbols = new Set(watchlist.map(w => w.symbol));
                const filteredResults = results.filter(s => !activeSymbols.has(s.symbol));

                return filteredResults.length > 0 ? (
                  <ul
                    role="listbox"
                    aria-label="Stock suggestions"
                    className="absolute top-full left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto custom-scrollbar p-1 flex flex-col gap-0.5 list-none m-0"
                  >
                    {filteredResults.map(stock => (
                      <li key={stock.symbol} role="option" aria-selected="false">
                        <button
                          onMouseDown={() => handleAddSymbol(stock.symbol)}
                          className="w-full text-left px-3 py-1.5 hover:bg-surface-container rounded-lg transition-colors cursor-pointer border-none bg-transparent flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-primary">{stock.symbol}</span>
                            <span className="text-[10px] text-on-surface-variant truncate max-w-[150px]">{stock.name}</span>
                          </div>
                          <span className="text-[9px] bg-secondary/15 text-secondary px-1 py-0.5 rounded font-bold uppercase" aria-hidden="true">Add</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null;
              })()
            )}
          </div>
        </section>

        {/* Alerts Log Panel */}
        <section style={{padding: '10px 10px 10px 10px'}} className="glass-panel p-5 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-outline-variant pb-2 shrink-0">
            <h3 className="text-xs font-extrabold text-primary uppercase flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">notifications_active</span>
              Recent Triggered Alerts
            </h3>
            <span style={{padding: '5px 5px 5px 5px'}} className="text-[9px] bg-secondary/15 text-secondary px-1.5 py-0.5 rounded font-bold" aria-label="Live data">LIVE</span>
          </div>

          <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1" role="log" aria-live="polite" aria-label="Alert history">
            {logs.length === 0 ? (
              <p className="text-on-surface-variant italic text-center py-6 text-[10px]">No alerts triggered yet.</p>
            ) : (
              logs.map((log) => {
                const date = new Date(log.created_at);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

                let icon = 'info';
                let iconColor = 'text-primary-fixed-dim';
                if (log.alert_type === 'STOP_LOSS') {
                  icon = 'warning';
                  iconColor = 'text-error';
                } else if (log.alert_type === 'TARGET_PRICE') {
                  icon = 'stars';
                  iconColor = 'text-secondary';
                }

                return (
                  <div key={log.id} className="flex gap-2.5 p-2.5 bg-surface-container border border-outline-variant rounded-xl items-start">
                    <span className={`material-symbols-outlined text-[18px] ${iconColor} mt-0.5 shrink-0`} aria-hidden="true">
                      {icon}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-primary text-[11px]">{log.symbol}</span>
                        <span className="text-[8px] text-on-surface-variant font-bold uppercase">{log.alert_type.replace('_', ' ')}</span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant leading-relaxed">
                        {renderSafeMessage(log.message)}
                      </p>
                      <span className="text-[8px] text-on-surface-variant/70 font-semibold mt-1">
                        {dateStr} at {timeStr} • Price: {log.triggered_price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteSymbol && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) cancelDelete(); }}
        >
          <div
            ref={confirmModalRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-title"
            aria-describedby="confirm-delete-desc"
            className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-2xl max-w-sm w-full flex flex-col gap-4"
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-error text-[24px] mt-0.5 shrink-0" aria-hidden="true">delete_forever</span>
              <div className="flex flex-col gap-1">
                <h3 id="confirm-delete-title" className="text-sm font-extrabold text-on-surface">Remove {confirmDeleteSymbol}?</h3>
                <p id="confirm-delete-desc" className="text-[11px] text-on-surface-variant leading-relaxed">
                  This will stop tracking <strong>{confirmDeleteSymbol}</strong> and remove it from your watchlist. Your alert history is not affected.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelDelete}
                className="px-4 py-2 border border-outline-variant text-[10px] font-bold uppercase rounded-lg hover:bg-surface-container cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 bg-error text-on-error text-[10px] font-bold uppercase rounded-lg hover:opacity-90 active:scale-95 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-error/50"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Thresholds Modal */}
      {editingItem && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeEditModal(); }}
        >
          <div
            ref={editModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-modal-title"
            className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-2xl max-w-md w-full flex flex-col gap-4"
          >
            <div className="flex justify-between items-center border-b border-outline-variant pb-2">
              <div>
                <h3 id="edit-modal-title" className="text-sm font-extrabold text-primary uppercase">Configure Alerts: {editingItem.symbol}</h3>
                <p className="text-[10px] text-on-surface-variant font-medium">Set purchase cost and threshold alert prices.</p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                aria-label="Close configure alerts dialog"
                className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container border-none text-on-surface-variant hover:bg-surface-container-high cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
              </button>
            </div>

            {/* Inline modal error */}
            {modalError && (
              <div role="alert" className="flex items-center gap-2 bg-error/10 border border-error/25 text-error rounded-xl p-3 text-[11px] font-bold">
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">error</span>
                {modalError}
              </div>
            )}

            <form onSubmit={handleUpdateItem} className="flex flex-col gap-4" noValidate>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-extrabold text-on-surface-variant uppercase tracking-wider" htmlFor="purchase-price">
                    Average Purchase Cost (PKR)
                  </label>
                  <input
                    id="purchase-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={costInput}
                    onChange={(e) => setCostInput(e.target.value)}
                    placeholder="E.g. 150.50"
                    className="bg-surface-container border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-extrabold text-on-surface-variant uppercase tracking-wider" htmlFor="stock-quantity">
                    Number of Stocks
                  </label>
                  <input
                    id="stock-quantity"
                    type="number"
                    step="1"
                    min="0"
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                    placeholder="E.g. 100"
                    className="bg-surface-container border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-extrabold text-on-surface-variant uppercase tracking-wider flex items-center gap-1" htmlFor="stop-loss-price">
                    <span className="material-symbols-outlined text-error text-[12px]" aria-hidden="true">trending_down</span>
                    Stop Loss (PKR)
                  </label>
                  <input
                    id="stop-loss-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={slInput}
                    onChange={(e) => setSlInput(e.target.value)}
                    placeholder={editingItem.is_custom_stop_loss || editingItem.stop_loss == null ? "Alert below price" : `SL: ${editingItem.stop_loss.toFixed(2)} (auto)`}
                    className="bg-surface-container border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-extrabold text-on-surface-variant uppercase tracking-wider flex items-center gap-1" htmlFor="target-price-input">
                    <span className="material-symbols-outlined text-secondary text-[12px]" aria-hidden="true">trending_up</span>
                    Target Price (PKR)
                  </label>
                  <input
                    id="target-price-input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={tpInput}
                    onChange={(e) => setTpInput(e.target.value)}
                    placeholder={editingItem.is_custom_target || editingItem.target_price == null ? "Alert above price" : `TP: ${editingItem.target_price.toFixed(2)} (auto)`}
                    className="bg-surface-container border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between bg-surface-container/30 border border-outline-variant/60 p-3 rounded-xl">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-on-surface" id="alert-on-signal-label">Technical Signal Alerts</span>
                  <span className="text-[8px] text-on-surface-variant">Notify when indicators flip (e.g. BUY ➔ SELL)</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer" aria-labelledby="alert-on-signal-label">
                  <input
                    type="checkbox"
                    checked={alertOnSignal}
                    onChange={(e) => setAlertOnSignal(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-outline-variant peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary"></div>
                </label>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-outline-variant mt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 border border-outline-variant text-[10px] font-bold uppercase rounded-lg hover:bg-surface-container cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  aria-busy={updating}
                  className="px-4 py-2 bg-primary text-on-primary text-[10px] font-bold uppercase rounded-lg hover:opacity-90 active:scale-95 cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {updating && <span className="material-symbols-outlined text-[14px] animate-spin" aria-hidden="true">sync</span>}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
