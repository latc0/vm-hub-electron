import React from 'react';
import {
  LayoutDashboard,
  Wifi,
  Network,
  Globe,
  Wrench,
  Settings,
  ShieldCheck,
  LogOut,
  Radio,
  Server,
  ShieldAlert,
  Activity
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, routerStatus, onLogout }) {
  const menuItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'wifi', label: 'Wi-Fi Settings', icon: Wifi },
    { id: 'dhcp', label: 'DHCP & LAN', icon: Network },
    { id: 'dns', label: 'DNS & Domains', icon: Globe },
    { id: 'ports', label: 'Port Rules & Firewall', icon: ShieldAlert },
    { id: 'logs', label: 'Modem Logs & DOCSIS', icon: Activity },
    { id: 'tools', label: 'Network Tools', icon: Wrench },
    { id: 'settings', label: 'Settings & Hardware', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900/90 border-r border-slate-800/80 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-red-500 to-amber-500 flex items-center justify-center shadow-lg shadow-red-950/40">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-sm tracking-wide text-slate-100 flex items-center gap-1.5">
              Hub 5 Manager
            </div>
            <div className="text-[11px] text-slate-400 font-mono">Virgin Media RDK-B</div>
          </div>
        </div>

        {/* Status Pill Card */}
        <div className="mx-4 my-3.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/70 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className={`w-2 h-2 rounded-full ${routerStatus.authenticated ? 'bg-emerald-400 animate-pulse' :
              routerStatus.mockMode ? 'bg-amber-400' : 'bg-rose-500'
              }`} />
            <span className="text-slate-300 font-medium">
              {routerStatus.authenticated ? 'Authenticated' :
                routerStatus.mockMode ? 'Mock Mode' : 'Not Connected'}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            {routerStatus.mockMode ? 'DEMO' : 'LIVE'}
          </span>
        </div>

        {/* Navigation Menu */}
        <nav className="px-3 space-y-1 mt-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${isActive
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-rose-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Router Details */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
          <span className="flex items-center gap-1.5 font-mono">
            <Server className="w-3.5 h-3.5 text-slate-500" />
            {routerStatus.routerBaseUrl ? routerStatus.routerBaseUrl.replace(/^https?:\/\//, '') : '192.168.0.1'}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">
            v1 REST
          </span>
        </div>

        {routerStatus.authenticated && (
          <button
            onClick={onLogout}
            className="w-full mt-2 flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-md bg-slate-800/80 hover:bg-rose-950/40 hover:text-rose-300 text-slate-400 text-xs transition-colors border border-slate-700/60"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>End Session</span>
          </button>
        )}
      </div>
    </aside>
  );
}

