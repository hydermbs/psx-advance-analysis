import React, { useState, useEffect } from 'react';

interface StockInfo {
  symbol: string;
  name: string;
  sector: string;
  is_etf: boolean;
  exchange: string;
}

interface DipAlert {
  id: number;
  symbol: string;
  quantity: number;
  sell_price: number;
  target_type: 'percentage' | 'custom' | 'technical';
  dip_percentage: number | null;
  target_price: number;
  is_active: boolean;
  is_triggered: boolean;
  triggered_price: number | null;
  triggered_at: string | null;
  created_at: string;
  current_price: number | null;
  progress_percent: number;
  potential_savings: number;
  error: string | null;
}

interface DipAlertsDashboardProps {
  stocks: StockInfo[];
  onSelectSymbol?: (symbol: string) => void;
}

export const DipAlertsDashboard: React.FC<DipAlertsDashboardProps> = ({ stocks, onSelectSymbol }) => {
  const [alerts, setAlerts] = useState<DipAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [searchVal, setSearchVal] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockInfo | null>(null);
  const [quantity, setQuantity] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [targetType, setTargetType] = useState<'percentage' | 'custom' | 'technical'>('percentage');
  const [dipPercentage, setDipPercentage] = useState('5');
  const [customTargetPrice, setCustomTargetPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Alert
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const fetchAlerts = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/dip-alerts');
      if (!res.ok) throw new Error('Failed to fetch dip alerts');
      const data = await res.json();
      setAlerts(data);
    } catch (err: any) {
      console.error(err);
      setError('Could not load dip alerts data');
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    await fetchAlerts();
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      fetchAlerts();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const symbol = selectedStock?.symbol || searchVal.trim().toUpperCase();
    if (!symbol) {
      setFormError('Please select or enter a stock symbol.');
      return;
    }

    const qtyVal = parseInt(quantity, 10);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      setFormError('Please enter a valid quantity greater than 0.');
      return;
    }

    const sellVal = parseFloat(sellPrice);
    if (isNaN(sellVal) || sellVal <= 0) {
      setFormError('Please enter a valid sell price greater than 0.');
      return;
    }

    let payload: any = {
      symbol,
      quantity: qtyVal,
      sell_price: sellVal,
      target_type: targetType
    };

    if (targetType === 'percentage') {
      const dipVal = parseFloat(dipPercentage);
      if (isNaN(dipVal) || dipVal <= 0 || dipVal > 100) {
        setFormError('Please enter a dip percentage between 0 and 100.');
        return;
      }
      payload.dip_percentage = dipVal;
    } else if (targetType === 'custom') {
      const targetVal = parseFloat(customTargetPrice);
      if (isNaN(targetVal) || targetVal <= 0) {
        setFormError('Please enter a target price greater than 0.');
        return;
      }
      if (targetVal >= sellVal) {
        setFormError('Target re-entry price must be lower than your sell price.');
        return;
      }
      payload.target_price = targetVal;
    }

    setSubmitting(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/dip-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to create dip alert');
      }

      // Reset form
      setSearchVal('');
      setSelectedStock(null);
      setQuantity('');
      setSellPrice('');
      setCustomTargetPrice('');
      setDipPercentage('5');
      setTargetType('percentage');
      await fetchAlerts();
    } catch (err: any) {
      setFormError(err.message || 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAlert = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/dip-alerts/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete dip alert');
      setConfirmDeleteId(null);
      await fetchAlerts();
    } catch (err: any) {
      alert(err.message || 'Failed to delete alert');
    }
  };

  // Calculations for summary stats
  const activeAlerts = alerts.filter(a => a.is_active);
  const triggeredAlerts = alerts.filter(a => !a.is_active && a.is_triggered);

  const totalPotentialSavings = activeAlerts.reduce((acc, curr) => acc + (curr.potential_savings > 0 ? curr.potential_savings : 0), 0);
  const totalRealizedSavings = triggeredAlerts.reduce((acc, curr) => acc + curr.potential_savings, 0);

  // Helper to calculate instant target price preview
  const getTargetPricePreview = () => {
    const sellVal = parseFloat(sellPrice);
    if (isNaN(sellVal) || sellVal <= 0) return null;

    if (targetType === 'percentage') {
      const dipVal = parseFloat(dipPercentage);
      if (isNaN(dipVal) || dipVal <= 0 || dipVal > 100) return null;
      return sellVal * (1 - dipVal / 100);
    } else if (targetType === 'custom') {
      const targetVal = parseFloat(customTargetPrice);
      if (isNaN(targetVal) || targetVal <= 0) return null;
      return targetVal;
    } else if (targetType === 'technical') {
      return 'Nearest Support Level (Calculated on submit)';
    }
    return null;
  };

  const previewTarget = getTargetPricePreview();

  return (
    <div className="grid grid-cols-12 gap-6 w-full">
      {/* Top Summary Cards */}
      <div style={{ padding: '10px 10px 10px 10px' }} className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Active Dip Watches */}
        <div style={{ padding: '10px 10px 10px 10px' }} className="glass-panel p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Active Dip Watches</span>
              <span className="text-lg font-black text-on-surface tabular-nums">
                {activeAlerts.length}
              </span>
            </div>
            <span className="material-symbols-outlined text-[20px] text-primary bg-surface-container p-2 rounded-lg" aria-hidden="true">visibility</span>
          </div>
        </div>

        {/* Card 2: Potential Re-entry Savings */}
        <div style={{ padding: '10px 10px 10px 10px' }} className="glass-panel p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Potential Buyback Savings</span>
              <span className="text-lg font-black text-secondary tabular-nums">
                PKR {totalPotentialSavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <span className="material-symbols-outlined text-[20px] text-secondary bg-secondary/15 p-2 rounded-lg" aria-hidden="true">savings</span>
          </div>
        </div>

        {/* Card 3: Realized Dip Savings */}
        <div style={{ padding: '10px 10px 10px 10px' }} className="glass-panel p-4 flex flex-col justify-between border-l-4 border-l-secondary">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Realized Buyback Savings</span>
              <span className="text-lg font-black text-secondary tabular-nums">
                PKR {totalRealizedSavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] font-extrabold mt-0.5 text-on-surface-variant">
                Across {triggeredAlerts.length} triggered dip-buys
              </span>
            </div>
            <span className="material-symbols-outlined text-[20px] text-secondary bg-secondary/15 p-2 rounded-lg" aria-hidden="true">check_circle</span>
          </div>
        </div>
      </div>

      {/* Main Alerts Grid Column */}
      <div style={{ paddingTop: '10px' }} className="col-span-12 lg:col-span-8 flex flex-col gap-6">
        <div style={{ padding: '10px 10px 10px 10px' }} className="glass-panel p-5 flex flex-col gap-4">
          <div className="flex justify-between items-center shrink-0">
            <div>
              <h2 className="text-base font-extrabold text-primary uppercase">Active Dip Monitors</h2>
              <p className="text-[10px] text-on-surface-variant font-bold tracking-wider uppercase">Stocks you sold, waiting to buy back lower</p>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-outline-variant text-[10px] font-bold uppercase rounded-lg hover:bg-surface-container-high cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className={`material-symbols-outlined text-[14px] ${loading ? 'animate-spin' : ''}`} aria-hidden="true">sync</span>
              Refresh
            </button>
          </div>

          {error && (
            <div className="bg-error/10 border border-error/25 text-error text-[10px] font-bold p-3 rounded-lg flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">error</span>
              {error}
            </div>
          )}

          {loading && alerts.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center min-h-[300px]">
              <span className="material-symbols-outlined text-primary text-[32px] animate-spin mb-3">sync</span>
              <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">Syncing Dip Monitors...</p>
            </div>
          ) : activeAlerts.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center min-h-[250px] border border-dashed border-outline-variant rounded-xl text-center">
              <span className="material-symbols-outlined text-on-surface-variant text-[44px] mb-3">explore</span>
              <h3 className="text-xs font-bold text-on-surface">No active dip monitors</h3>
              <p className="text-on-surface-variant text-[10px] mt-1 max-w-[280px]">Use the panel on the right to log a sale. We will monitor the price and notify you when the dip target is hit.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeAlerts.map((alert) => {
                const savingsColorClass = alert.potential_savings >= 0 ? 'text-secondary bg-secondary/10' : 'text-error bg-error/10';

                return (
                  <div key={alert.id} className="border border-outline-variant rounded-xl p-4 flex flex-col justify-between gap-3 bg-surface-container-lowest hover:shadow-md transition-shadow relative">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 
                            onClick={() => onSelectSymbol?.(alert.symbol)}
                            className="text-sm font-black text-primary hover:text-secondary cursor-pointer focus:underline"
                          >
                            {alert.symbol}
                          </h4>
                          <span className="text-[9px] bg-surface-container text-on-surface-variant font-bold px-1.5 py-0.5 rounded uppercase">
                            {alert.target_type}
                          </span>
                        </div>
                        <span className="text-[10px] text-on-surface-variant font-medium block truncate max-w-[180px]">
                          {stocks.find(s => s.symbol === alert.symbol)?.name || 'Asset'}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => setConfirmDeleteId(alert.id)}
                        className="text-on-surface-variant hover:text-error hover:bg-error/5 p-1 rounded transition-colors cursor-pointer"
                        title="Delete Monitor"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>

                    {/* Stats Rows */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] tabular-nums mt-1 border-t border-b border-outline-variant/40 py-2">
                      <div>
                        <span className="text-[9px] text-on-surface-variant uppercase font-bold block">Sold Price</span>
                        <span className="font-extrabold text-on-surface">PKR {alert.sell_price.toFixed(2)}</span>
                        <span className="text-[9px] text-on-surface-variant block mt-0.5">Qty: {alert.quantity}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-on-surface-variant uppercase font-bold block">Target Re-entry</span>
                        <span className="font-extrabold text-primary">PKR {alert.target_price.toFixed(2)}</span>
                        <span className="text-[9px] text-on-surface-variant block mt-0.5">
                          {alert.target_type === 'percentage' ? `(-${alert.dip_percentage}%)` : 'Technical'}
                        </span>
                      </div>
                      <div className="mt-1">
                        <span className="text-[9px] text-on-surface-variant uppercase font-bold block">Last Price</span>
                        <span className="font-extrabold text-on-surface">
                          {alert.current_price != null ? `PKR ${alert.current_price.toFixed(2)}` : 'Loading...'}
                        </span>
                      </div>
                      <div className="mt-1">
                        <span className="text-[9px] text-on-surface-variant uppercase font-bold block">Divergence</span>
                        {alert.current_price != null ? (
                          (() => {
                            const diffPercent = ((alert.current_price - alert.target_price) / alert.target_price) * 100;
                            return (
                              <span className={`font-bold ${diffPercent <= 0 ? 'text-secondary' : 'text-on-surface-variant'}`}>
                                {diffPercent <= 0 ? 'Target Hit!' : `+${diffPercent.toFixed(1)}% to Target`}
                              </span>
                            );
                          })()
                        ) : (
                          <span className="font-medium">Loading...</span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-on-surface-variant font-bold">Dip Progress</span>
                        <span className="font-extrabold text-primary">{alert.progress_percent}%</span>
                      </div>
                      <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-secondary transition-all duration-500" 
                          style={{ width: `${alert.progress_percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Savings Indicator */}
                    <div className={`p-2 rounded-lg flex items-center justify-between mt-1 ${savingsColorClass}`}>
                      <span className="text-[9px] font-extrabold uppercase">Potential Savings</span>
                      <span className="text-xs font-black tabular-nums">
                        {alert.potential_savings >= 0 ? '+' : ''}PKR {alert.potential_savings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Delete Confirmation Overlay */}
                    {confirmDeleteId === alert.id && (
                      <div className="absolute inset-0 bg-surface-container-lowest/95 z-10 flex flex-col justify-center items-center text-center p-4 rounded-xl border border-outline-variant">
                        <h4 className="text-xs font-bold text-on-surface">Delete this dip alert?</h4>
                        <p className="text-[9px] text-on-surface-variant mt-1">This will stop tracking the re-entry level for {alert.symbol}.</p>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-3 py-1 bg-surface-container border border-outline-variant text-[10px] font-bold uppercase rounded-lg hover:bg-surface-container-high cursor-pointer transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDeleteAlert(alert.id)}
                            className="px-3 py-1 bg-error text-on-error text-[10px] font-bold uppercase rounded-lg hover:opacity-90 cursor-pointer transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Triggered Dip Log */}
        {triggeredAlerts.length > 0 && (
          <div style={{ padding: '10px 10px 10px 10px' }} className="glass-panel p-5 flex flex-col gap-4">
            <h3 className="text-xs font-extrabold text-primary uppercase">Triggered Dip Logs</h3>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant font-bold text-[10px] uppercase tracking-wider">
                    <th className="pb-3 pl-2" scope="col">Asset</th>
                    <th className="pb-3 text-right" scope="col">Sold At</th>
                    <th className="pb-3 text-right" scope="col">Target Target</th>
                    <th className="pb-3 text-right" scope="col">Buyback Price</th>
                    <th className="pb-3 text-right" scope="col">Qty</th>
                    <th className="pb-3 text-right pr-2" scope="col">Realized Savings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50 tabular-nums">
                  {triggeredAlerts.map((alert) => {
                    const buybackPrice = alert.triggered_price || alert.target_price;
                    return (
                      <tr key={alert.id} className="hover:bg-surface-container/30 transition-colors">
                        <td className="py-2.5 pl-2 font-bold text-primary">{alert.symbol}</td>
                        <td className="py-2.5 text-right text-on-surface-variant">PKR {alert.sell_price.toFixed(2)}</td>
                        <td className="py-2.5 text-right text-on-surface-variant">PKR {alert.target_price.toFixed(2)}</td>
                        <td className="py-2.5 text-right text-secondary font-semibold">PKR {buybackPrice.toFixed(2)}</td>
                        <td className="py-2.5 text-right text-on-surface-variant">{alert.quantity}</td>
                        <td className="py-2.5 text-right text-secondary font-bold pr-2">
                          PKR {alert.potential_savings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Right Column Form Column */}
      <div style={{ paddingTop: '10px' }} className="col-span-12 lg:col-span-4 flex flex-col gap-6">
        <section style={{ padding: '10px 10px 10px 10px' }} className="glass-panel p-5 flex flex-col gap-3">
          <h3 className="text-xs font-extrabold text-primary uppercase">Log Sold Position</h3>
          <p className="text-[10px] text-on-surface-variant font-medium leading-relaxed">
            Record a stock you sold to monitor re-entry buying opportunities.
          </p>

          <form onSubmit={handleAddAlert} className="flex flex-col gap-4 mt-2">
            {/* Symbol Autocomplete Search */}
            <div className="relative flex flex-col gap-1">
              <label className="text-[9px] font-extrabold text-on-surface-variant uppercase tracking-wider" htmlFor="ticker-autocomplete">
                Stock Ticker
              </label>
              <input
                id="ticker-autocomplete"
                className="w-full bg-surface-container border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
                placeholder="Search ticker (e.g. HUBC, SYS)"
                type="text"
                value={selectedStock ? selectedStock.symbol : searchVal}
                onChange={(e) => {
                  setSearchVal(e.target.value);
                  setSelectedStock(null);
                }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => {
                  setTimeout(() => setSearchFocused(false), 200);
                }}
                autoComplete="off"
              />

              {/* Autocomplete Suggestions */}
              {searchFocused && (
                (() => {
                  const filtered = searchVal.trim() !== ''
                    ? stocks.filter(s =>
                        s.symbol.toUpperCase().includes(searchVal.toUpperCase()) ||
                        s.name.toUpperCase().includes(searchVal.toUpperCase())
                      )
                    : stocks.slice(0, 10);

                  return filtered.length > 0 ? (
                    <ul className="absolute top-[100%] left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto custom-scrollbar p-1 flex flex-col gap-0.5 list-none m-0">
                      {filtered.map(s => (
                        <li key={s.symbol} className="list-none">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStock(s);
                              setSearchVal(s.symbol);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-on-surface hover:bg-surface-container cursor-pointer transition-colors bg-transparent border-none focus:outline-none"
                          >
                            <span className="font-extrabold text-primary mr-1.5">{s.symbol}</span>
                            <span className="text-[10px] text-on-surface-variant font-medium truncate inline-block max-w-[160px] align-middle">{s.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null;
                })()
              )}
            </div>

            {/* Quantity and Sold Price Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-extrabold text-on-surface-variant uppercase tracking-wider" htmlFor="quantity-sold">
                  Qty Sold
                </label>
                <input
                  id="quantity-sold"
                  type="number"
                  min="1"
                  placeholder="e.g. 500"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="bg-surface-container border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-extrabold text-on-surface-variant uppercase tracking-wider" htmlFor="sold-price">
                  Sold Price (PKR)
                </label>
                <input
                  id="sold-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 120.50"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  className="bg-surface-container border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
                  required
                />
              </div>
            </div>

            {/* Target Re-entry Method */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-extrabold text-on-surface-variant uppercase tracking-wider">
                Re-entry Buying strategy
              </label>
              
              <div className="grid grid-cols-3 gap-1 bg-surface-container border border-outline-variant p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTargetType('percentage')}
                  className={`py-1.5 text-[10px] font-bold uppercase rounded-lg cursor-pointer transition-all ${
                    targetType === 'percentage'
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface bg-transparent border-none'
                  }`}
                >
                  % Dip
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType('custom')}
                  className={`py-1.5 text-[10px] font-bold uppercase rounded-lg cursor-pointer transition-all ${
                    targetType === 'custom'
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface bg-transparent border-none'
                  }`}
                >
                  Custom
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType('technical')}
                  className={`py-1.5 text-[10px] font-bold uppercase rounded-lg cursor-pointer transition-all ${
                    targetType === 'technical'
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface bg-transparent border-none'
                  }`}
                >
                  Technical
                </button>
              </div>
            </div>

            {/* Conditional input fields */}
            {targetType === 'percentage' && (
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-extrabold text-on-surface-variant uppercase tracking-wider" htmlFor="dip-percentage-input">
                  Dip Percentage
                </label>
                <div className="relative">
                  <input
                    id="dip-percentage-input"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="99"
                    value={dipPercentage}
                    onChange={(e) => setDipPercentage(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant rounded-xl p-2.5 pr-8 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">%</span>
                </div>
              </div>
            )}

            {targetType === 'custom' && (
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-extrabold text-on-surface-variant uppercase tracking-wider" htmlFor="custom-target-price-input">
                  Target Purchase Price (PKR)
                </label>
                <input
                  id="custom-target-price-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 110.00"
                  value={customTargetPrice}
                  onChange={(e) => setCustomTargetPrice(e.target.value)}
                  className="bg-surface-container border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
                  required
                />
              </div>
            )}

            {targetType === 'technical' && (
              <div className="p-3 bg-secondary/5 border border-secondary/15 rounded-xl text-[10.5px] text-on-surface-variant leading-relaxed">
                <div className="flex items-center gap-1 font-extrabold text-secondary mb-1">
                  <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                  ALGORITHMIC RE-ENTRY
                </div>
                The system will analyze the historical 1d charts to find the nearest key support level (using Lower Bollinger Band, 50-day SMA, or swing lows) strictly below your sell price.
              </div>
            )}

            {/* Target Price Preview Banner */}
            {previewTarget && (
              <div className="bg-surface-container border border-outline-variant rounded-xl p-3 flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-bold">Target Re-entry:</span>
                <span className="font-extrabold text-primary">
                  {typeof previewTarget === 'number' ? `PKR ${previewTarget.toFixed(2)}` : previewTarget}
                </span>
              </div>
            )}

            {/* Form Error Message */}
            {formError && (
              <div className="bg-error/10 border border-error/25 text-error text-[10px] font-bold p-2.5 rounded-lg flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">error</span>
                {formError}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-on-primary font-bold py-2.5 rounded-xl text-xs hover:bg-primary/95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex justify-center items-center gap-1.5"
            >
              {submitting && <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>}
              Start Monitoring Dip
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
