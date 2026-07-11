import React from 'react';

interface SignalData {
  signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' | string;
  confidence: number;
  entry: number;
  stop_loss: number;
  target: number;
  risk_reward: number;
  factors: string[];
}

interface SignalDashboardProps {
  signals: SignalData;
  symbol: string;
}

export const SignalDashboard: React.FC<SignalDashboardProps> = ({ signals, symbol }) => {
  const { signal, confidence, entry, stop_loss, target, risk_reward, factors } = signals;

  const isBuy = signal.includes('BUY');
  const isSell = signal.includes('SELL');
  
  let bgClass = 'bg-outline text-white';
  let textBadgeClass = 'text-primary-fixed-dim';
  let badgeText = 'HOLD';
  let iconName = 'info';
  let description = `${symbol} is currently holding its current range. Momentum indicators are neutral, and a breakout is required to confirm direction.`;

  if (isBuy) {
    bgClass = 'bg-secondary text-white';
    textBadgeClass = 'text-secondary-fixed';
    badgeText = signal.replace('_', ' ');
    iconName = 'verified';
    description = `${symbol} shows robust momentum and institutional accumulation, with indicators aligning for a high-probability breakout.`;
  } else if (isSell) {
    bgClass = 'bg-error text-white';
    textBadgeClass = 'text-rose-200';
    badgeText = signal.replace('_', ' ');
    iconName = 'gpp_maybe';
    description = `${symbol} exhibits weakness and distribution. Risk management is recommended as support levels are being tested.`;
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Analyst Verdict Card */}
      <section className={`${bgClass} rounded-xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[300px] transition-all`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16 blur-3xl"></div>
        <div style = {{marginTop:'10px'}}>
          <h3 className="text-center font-bold text-[9px] uppercase tracking-[0.2em] mb-4 opacity-80">Analyst Verdict</h3>
          <div className="flex items-baseline justify-center gap-2 mb-3">
            <span className="text-2xl font-extrabold tracking-tight leading-none uppercase">{badgeText}</span>
            <span className={`material-symbols-outlined text-[24px] ${textBadgeClass}`} style={{ fontVariationSettings: "'FILL' 1" }}>
              {iconName}
            </span>
          </div>
          <p className="text-center text-[12px] leading-relaxed opacity-95 mb-5">{description}</p>
          
          <h4 className="text-center text-[10px] font-bold uppercase tracking-wider opacity-85 mb-2.5">Key Confluence</h4>
          <ul className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
            {factors.slice(0, 4).map((factor, index) => (
              <li key={index} className="flex items-start justify-center gap-2 text-center">
                <span className={`material-symbols-outlined text-[15px] ${textBadgeClass} mt-0.5 flex-shrink-0`}>check_circle</span>
                <span className="text-[11px] leading-snug opacity-95">{factor}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div style= {{marginBottom:'10px'}}className="mt-5 border-t border-white/20 pt-4 flex items-center justify-between shrink-0">
          <span style={{marginLeft:'10px'}}className="text-[10px] font-bold uppercase tracking-wider opacity-80">Confidence</span>
          <span style={{marginRight:'10px'}}className={`text-[12px] font-bold px-2 py-0.5  ${textBadgeClass}`}>
            {confidence}%
          </span>
        </div>
      </section>

      {/* Recommended Trade Levels */}
      <section className="glass-panel p-5 flex flex-col gap-4">
        <h4 style={{margin:'10px 0px 10px 0px'}}className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-outline-variant pb-2.5 flex items-center justify-center gap-1.5 shrink-0">
          <span className="material-symbols-outlined text-secondary text-[18px]">ads_click</span>
          Trading Execution levels
        </h4>
        
        <div className="grid grid-cols-2 gap-y-4 gap-x-2 tabular-nums">
          <div className="flex flex-col items-center text-center gap-0.5">
            <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">Entry Level</span>
            <span className="text-xs font-extrabold text-on-surface">PKR {entry.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex flex-col items-center text-center gap-0.5">
            <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">Risk Reward</span>
            <span className="text-xs font-extrabold text-secondary">{risk_reward.toFixed(1)} : 1</span>
          </div>
          <div style={{ marginBottom: '20px' }}   className="flex flex-col items-center text-center gap-0.5 border-t border-outline-variant pt-2.5 mt-0.5">
            <div  className="flex items-center justify-center gap-1 text-[9px] text-on-surface-variant font-bold uppercase tracking-wider mb-0.5">
              <span  className="material-symbols-outlined text-error text-[13px]">security</span>
              <span>Stop Loss</span>
            </div>
            <span className="text-xs font-extrabold text-error">PKR {stop_loss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div style={{ marginBottom:'20px'}} className="flex flex-col items-center text-center gap-0.5 border-t border-outline-variant pt-2.5 mt-0.5">
            <div className="flex items-center justify-center gap-1 text-[9px] text-on-surface-variant font-bold uppercase tracking-wider mb-0.5">
              <span className="material-symbols-outlined text-secondary text-[13px]">track_changes</span>
              <span>Target Price</span>
            </div>
            <span className="text-xs font-extrabold text-secondary">PKR {target.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </section>
    </div>
  );
};
