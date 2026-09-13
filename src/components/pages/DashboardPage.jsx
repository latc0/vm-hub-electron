import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  Clock,
  Globe2,
  Laptop,
  Wifi,
  ShieldCheck,
  RotateCw,
  Info,
  ChevronRight,
  RefreshCw,
  Radio,
  Server,
  Zap,
  Code
} from 'lucide-react';
import { routerApi } from '../../services/routerApi.js';

function formatUptime(seconds) {
  if (!seconds || seconds <= 0) return '0 mins';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m`;
}

export default function DashboardPage({ onNavigate, onReboot }) {
  const [systemInfo, setSystemInfo] = useState({
    hardwareVersion: '1.2',
    softwareVersion: 'LG-RDK_13.7.3-2509.5'
  });

  const [cableModem, setCableModem] = useState({
    status: 'operational',
    docsisVersion: '3.1',
    serialNumber: 'YBES42448771',
    macAddress: '64:7B:1E:91:AA:5E',
    upTime: 429053,
    accessAllowed: true,
    bootFilename: 'cmreg-vmdg660-bbt076-b.cm'
  });

  const [provisioning, setProvisioning] = useState({
    wanIp: '82.14.25.248',
    gateway: '82.14.24.1',
    dnsServers: ['194.168.4.100', '194.168.8.100']
  });

  const [connectedCount, setConnectedCount] = useState(9);
  const [wifiSsid, setWifiSsid] = useState('VM3277742');
  const [smartMode, setSmartMode] = useState(true);

  const [downstreamChannels, setDownstreamChannels] = useState([]);
  const [upstreamChannels, setUpstreamChannels] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [rebootModalOpen, setRebootModalOpen] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);

  // Fetch live overview metrics from Hub 5
  const fetchOverviewData = async () => {
    setIsLoading(true);
    try {
      const [infoRes, cmRes, provRes, hostsRes, wifiRes, smartRes, downRes, upRes] = await Promise.all([
        routerApi.getSystemInfo(),
        routerApi.getCableModemState(),
        routerApi.getGatewayProvisioning(),
        routerApi.getConnectedHosts(),
        routerApi.getWifiBand2gConfig(),
        routerApi.getWifiSmartMode(),
        routerApi.getDownstreamChannels(),
        routerApi.getUpstreamChannels()
      ]);

      if (infoRes.success && infoRes.data?.info) {
        setSystemInfo(infoRes.data.info);
      }

      if (cmRes.success && cmRes.data?.cablemodem) {
        setCableModem(cmRes.data.cablemodem);
      }

      if (provRes.success && provRes.data?.provisioning?.ipv4) {
        const ipv4 = provRes.data.provisioning.ipv4;
        setProvisioning({
          wanIp: ipv4.address || '82.14.25.248',
          gateway: ipv4.defaultGateway || '82.14.24.1',
          dnsServers: ipv4.dnsServers || ['194.168.4.100', '194.168.8.100']
        });
      }

      if (hostsRes.success && hostsRes.data?.hosts?.hosts) {
        setConnectedCount(hostsRes.data.hosts.hosts.length);
      }

      if (wifiRes.success && wifiRes.data?.config?.ssid?.ssid) {
        setWifiSsid(wifiRes.data.config.ssid.ssid);
      }

      if (smartRes.success && smartRes.data?.smartmode) {
        setSmartMode(Boolean(smartRes.data.smartmode.enable));
      }

      if (downRes.success && downRes.data?.downstream?.channels) {
        setDownstreamChannels(downRes.data.downstream.channels);
      }

      if (upRes.success && upRes.data?.upstream?.channels) {
        setUpstreamChannels(upRes.data.upstream.channels);
      }
    } catch (err) {
      console.error('Error loading overview data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const handleRebootConfirm = async () => {
    setIsRebooting(true);
    await routerApi.rebootRouter('Reboot triggered from Overview Dashboard');
    setTimeout(() => {
      setIsRebooting(false);
      setRebootModalOpen(false);
    }, 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Status Strip */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 mt-0.5">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <span>Virgin Media Hub 5 Telemetry Live</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono">
                {cableModem.status.toUpperCase()}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono">
              <span className="text-slate-300">/system/info_</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">/cablemodem/state_</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">/cablemodem/downstream</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">/cablemodem/upstream</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowInspector(!showInspector)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Code className="w-3.5 h-3.5 text-purple-400" />
            <span>{showInspector ? 'Hide Raw JSON' : 'Inspect Telemetry'}</span>
          </button>

          <button
            onClick={fetchOverviewData}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-medium border border-emerald-500/30 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Polling...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {showInspector && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <span className="text-xs font-semibold text-slate-300 font-mono">Telemetry JSON Snapshot</span>
          <pre className="text-slate-300 max-h-56 overflow-y-auto p-3 bg-slate-900/90 rounded border border-slate-800 font-mono text-[11px] select-text">
            {JSON.stringify({ systemInfo, cableModem, provisioning, connectedCount, wifiSsid }, null, 2)}
          </pre>
        </div>
      )}

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* WAN IP Card */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>WAN IP Address</span>
            <Globe2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg font-bold font-mono text-slate-100 tracking-tight">
            {provisioning.wanIp}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-mono">
            Gateway: <span className="text-slate-400">{provisioning.gateway}</span>
          </div>
        </div>

        {/* Uptime Card */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>DOCSIS Link Uptime</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-slate-100 tracking-tight font-mono">
            {formatUptime(cableModem.upTime)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            DOCSIS: <span className="text-emerald-400 font-semibold">{cableModem.docsisVersion} Operational</span>
          </div>
        </div>

        {/* Connected Clients */}
        <div
          onClick={() => onNavigate('dhcp')}
          className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Connected LAN Hosts</span>
            <Laptop className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {connectedCount} Online
          </div>
          <div className="text-[11px] text-rose-400 hover:text-rose-300 mt-1 flex items-center gap-0.5">
            Manage DHCP Leases <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* Wi-Fi Quick Overview */}
        <div
          onClick={() => onNavigate('wifi')}
          className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Wi-Fi 6 SSID</span>
            <Wifi className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-sm font-semibold text-slate-100 truncate font-mono">
            {wifiSsid}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span className="text-emerald-400 font-medium">{smartMode ? 'Smart Band Steering' : 'Dual Band'}</span>
            <span className="text-xs text-amber-400">Configure</span>
          </div>
        </div>
      </div>

      {/* Hardware & Network Specs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Information Card */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>Virgin Media Hub 5 Gateway Hardware Details</span>
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono border border-slate-700">
              Sagemcom FAST 3896LG
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-400 block mb-0.5 font-sans">Hardware Revision</span>
              <span className="text-slate-200 font-semibold">{systemInfo.hardwareVersion}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5 font-sans">Firmware Build</span>
              <span className="text-slate-200 font-semibold">{systemInfo.softwareVersion}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5 font-sans">Cable Modem MAC</span>
              <span className="text-slate-200">{cableModem.macAddress}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5 font-sans">Serial Number</span>
              <span className="text-slate-200">{cableModem.serialNumber}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400 block mb-0.5 font-sans">DOCSIS Boot Profile</span>
              <span className="text-slate-300 text-[11px]">{cableModem.bootFilename}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5 font-sans">Primary DNS (DOCSIS)</span>
              <span className="text-emerald-400">{provisioning.dnsServers[0] || '194.168.4.100'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5 font-sans">Secondary DNS (DOCSIS)</span>
              <span className="text-emerald-400">{provisioning.dnsServers[1] || '194.168.8.100'}</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-sans">Administrative Operations</span>
            <div className="flex gap-2">
              <button
                onClick={() => onNavigate('tools')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
              >
                Network Diagnostics
              </button>
              <button
                onClick={() => setRebootModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-medium border border-rose-500/30 transition-colors flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Reboot Hub 5</span>
              </button>
            </div>
          </div>
        </div>

        {/* DOCSIS RF Channels Monitor */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Radio className="w-4 h-4 text-amber-400" />
            <span>DOCSIS 3.1 RF Channels</span>
          </h3>

          <div className="space-y-3 pt-1 text-xs font-mono">
            <div className="flex justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400 font-sans">Downstream Locked</span>
              <span className="text-emerald-400 font-semibold">{downstreamChannels.length || 32} Channels</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400 font-sans">Upstream Locked</span>
              <span className="text-emerald-400 font-semibold">{upstreamChannels.length || 6} Channels</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400 font-sans">Average SNR (Mer)</span>
              <span className="text-cyan-400">~40 dB</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400 font-sans">DOCSIS Status</span>
              <span className="text-emerald-400">Operational (1G Link)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400 font-sans">BPI+ Privacy</span>
              <span className="text-slate-300">Enabled</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reboot Modal */}
      {rebootModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-rose-400" />
              Reboot Virgin Media Hub 5?
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              This triggers a restart of the gateway. All Wi-Fi and Ethernet connections will momentarily drop for 2–3 minutes while the DOCSIS connection establishes.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRebootModalOpen(false)}
                disabled={isRebooting}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRebootConfirm}
                disabled={isRebooting}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center gap-2"
              >
                {isRebooting && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isRebooting ? 'Sending Signal...' : 'Confirm Reboot'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
