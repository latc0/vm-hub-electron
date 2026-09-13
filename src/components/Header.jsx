import React from 'react';
import { ShieldCheck, RefreshCw, KeyRound, AlertCircle, Sparkles } from 'lucide-react';

export default function Header({
  title,
  subtitle,
  routerStatus,
  onRefresh,
  isRefreshing,
  onToggleMock,
  onOpenSettings
}) {
  return (
    <header className="h-16 px-8 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur flex items-center justify-between shrink-0">
      <div>
        <h1 className="text-base font-semibold text-slate-100 tracking-tight flex items-center gap-2">
          {title}
        </h1>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>

      <div className="flex items-center space-x-3">
        {/* Mock Mode Quick Toggle */}
        <button
          onClick={onToggleMock}
          title={routerStatus.mockMode ? "Mock mode active (simulating responses)" : "Live router mode"}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${routerStatus.mockMode
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{routerStatus.mockMode ? 'Mock Data Active' : 'Live Router'}</span>
        </button>

        {/* Auth Badge */}
        {routerStatus.authenticated ? (
          <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px]">Token Valid</span>
          </div>
        ) : (
          <button
            onClick={onOpenSettings}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs hover:bg-rose-500/20 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Login Required</span>
          </button>
        )}

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 disabled:opacity-50 transition-colors"
          title="Refresh current data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-rose-400' : ''}`} />
        </button>
      </div>
    </header>
  );
}

