import React from 'react';
import { Target, ShieldAlert, Award, Compass, ShieldCheck } from 'lucide-react';

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

export const SignalDashboard: React.FC<SignalDashboardProps> = ({ signals }) => {
  const { signal, confidence, entry, stop_loss, target, risk_reward, factors } = signals;

  // Visual classes mapped to signal state
  const isBuy = signal.includes('BUY');
  const isSell = signal.includes('SELL');
  
  let signalColor = 'text-amber-500 bg-amber-950/20 border-amber-500/30';
  let glowClass = 'glow-hold';
  let badgeText = 'HOLD';
  
  if (isBuy) {
    signalColor = 'text-emerald-400 bg-emerald-950/20 border-emerald-500/30';
    glowClass = 'glow-buy';
    badgeText = signal.replace('_', ' ');
  } else if (isSell) {
    signalColor = 'text-rose-400 bg-rose-950/20 border-rose-500/30';
    glowClass = 'glow-sell';
    badgeText = signal.replace('_', ' ');
  }

  return (
    <div className="glass-panel p-4 flex flex-col gap-4 h-full">
      {/* Title */}
      <div className="flex items-center gap-2 pb-2 border-b border-[rgba(255,255,255,0.06)]">
        <Award className="text-blue-500 w-5 h-5" />
        <h2 className="text-lg font-bold tracking-tight">Signal Confluence</h2>
      </div>

      {/* Signal Display Ring */}
      <div className="flex flex-col items-center justify-center py-4 relative">
        <div className={`w-32 h-32 rounded-full border-2 flex flex-col items-center justify-center ${signalColor} ${glowClass} transition-all duration-500`}>
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Signal</span>
          <span className="text-base font-extrabold text-center tracking-tight leading-none px-2 uppercase mt-1">
            {badgeText}
          </span>
          <span className="text-xs text-slate-300 mt-1 font-semibold">{confidence}% conf</span>
        </div>
      </div>

      {/* Recommended Trade Levels */}
      <div className="grid grid-cols-2 gap-3 bg-[#0b0f19]/55 p-3 rounded-lg border border-[rgba(255,255,255,0.04)]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Entry Level</span>
          <span className="text-sm font-bold text-slate-200">PKR {entry.toFixed(2)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Risk Reward</span>
          <span className="text-sm font-bold text-blue-400">{risk_reward.toFixed(1)} : 1</span>
        </div>
        <div className="flex flex-col gap-0.5 border-t border-[rgba(255,255,255,0.04)] pt-2 mt-1">
          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            <ShieldAlert className="w-3 h-3 text-rose-500" />
            <span>Stop Loss</span>
          </div>
          <span className="text-sm font-bold text-rose-400">PKR {stop_loss.toFixed(2)}</span>
        </div>
        <div className="flex flex-col gap-0.5 border-t border-[rgba(255,255,255,0.04)] pt-2 mt-1">
          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            <Target className="w-3 h-3 text-emerald-500" />
            <span>Target Price</span>
          </div>
          <span className="text-sm font-bold text-emerald-400">PKR {target.toFixed(2)}</span>
        </div>
      </div>

      {/* Contributing Factors */}
      <div className="flex-1 flex flex-col gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-2">Contributing Factors</h3>
        <div className="flex flex-col gap-2 overflow-y-auto pr-1" style={{ maxHeight: '180px' }}>
          {factors.length > 0 ? (
            factors.map((factor, index) => (
              <div 
                key={index} 
                className="flex items-start gap-2 text-xs bg-[#0b0f19]/35 border border-[rgba(255,255,255,0.03)] p-2 rounded"
              >
                {factor.startsWith('Bullish') ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                ) : factor.startsWith('Bearish') ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <Compass className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                )}
                <span className="text-slate-300 leading-tight">{factor}</span>
              </div>
            ))
          ) : (
            <div className="text-slate-500 text-xs text-center italic py-4">
              No strong indicators influencing signal direction.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
