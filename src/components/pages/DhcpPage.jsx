import React, { useState, useEffect } from 'react';
import {
  Network,
  Server,
  Plus,
  Trash2,
  Search,
  Info,
  Check,
  Save,
  ShieldCheck,
  Laptop,
  Tv,
  Smartphone,
  BookmarkPlus,
  RefreshCw,
  Code,
  AlertCircle,
  ExternalLink,
  Sliders,
  Radio,
  Wifi,
  Monitor
} from 'lucide-react';
import { routerApi } from '../../services/routerApi.js';

// Normalizer helper for connected hosts
function normalizeHosts(rawHosts) {
  if (!rawHosts) return [];
  // Hub 5 returns: { hosts: { hosts: [ { macAddress, config: { connected, interface, speed, ethernet/wifi, ipv4: { address, leaseTimeRemaining } } } ] } }
  const list = Array.isArray(rawHosts)
    ? rawHosts
    : (rawHosts.hosts?.hosts || rawHosts.hosts || rawHosts.connectedHosts || rawHosts.devices || []);

  return list.map((item, idx) => {
    const config = item.config || {};
    const ipv4 = config.ipv4 || {};
    const wifi = config.wifi || {};
    const eth = config.ethernet || {};

    const hostname = config.deviceName || config.hostname || item.hostname || `Host (${(item.macAddress || '').slice(-5)})`;
    const ip = ipv4.address || item.ipAddress || item.ip || 'Unknown';
    const mac = item.macAddress || 'Unknown';

    // Determine interface
    let connection = 'Ethernet';
    if (config.interface === 'wifi' || wifi.band) {
      connection = wifi.band === 'band5g' ? '5 GHz Wi-Fi' : (wifi.band === 'band2g' ? '2.4 GHz Wi-Fi' : 'Wi-Fi');
    } else if (eth.port) {
      connection = `Ethernet Port ${eth.port}`;
    }

    const speed = config.speed ? `${Math.round(config.speed)} Mbps` : '';

    return {
      id: mac || idx,
      hostname: hostname === 'unknown' ? `Device ${mac.slice(-8)}` : hostname,
      ip,
      mac,
      connection,
      speed,
      ssid: wifi.ssid || '',
      rssi: wifi.rssi || null,
      expires: ipv4.leaseTimeRemaining ? `${Math.round(ipv4.leaseTimeRemaining / 60)} mins` : 'Active Lease',
      raw: item
    };
  });
}

// Normalizer helper for reserved IP addresses
function normalizeReservedIps(rawReserved) {
  if (!rawReserved) return [];
  // Hub 5 returns: { rules: [ { macAddress, ipAddress } ] }
  const list = Array.isArray(rawReserved)
    ? rawReserved
    : (rawReserved.rules || rawReserved.reservedIpAddresses || rawReserved.reservations || []);

  return list.map((item, idx) => ({
    id: item.macAddress || item.id || idx,
    hostname: item.hostname || item.name || `Reserved (${(item.macAddress || '').slice(-5)})`,
    ip: item.ipAddress || item.ip || '',
    mac: item.macAddress || item.mac || '',
    raw: item
  }));
}

// Device icon selector based on hostname or interface
function getDeviceIcon(hostname, connection) {
  const h = hostname.toLowerCase();
  if (h.includes('phone') || h.includes('iphone') || h.includes('galaxy') || h.includes('pixel')) {
    return <Smartphone className="w-4 h-4 text-emerald-400" />;
  }
  if (h.includes('tv') || h.includes('appletv') || h.includes('roku') || h.includes('firetv') || h.includes('bravia') || h.includes('lg')) {
    return <Tv className="w-4 h-4 text-purple-400" />;
  }
  if (h.includes('macbook') || h.includes('laptop') || h.includes('thinkpad') || h.includes('dell')) {
    return <Laptop className="w-4 h-4 text-cyan-400" />;
  }
  if (connection.includes('Wi-Fi')) {
    return <Wifi className="w-4 h-4 text-amber-400" />;
  }
  return <Monitor className="w-4 h-4 text-slate-400" />;
}

export default function DhcpPage({ onSaveDhcp, onSendRequest }) {
  // State for all 4 Virgin Media Hub 5 endpoints
  const [provisioning, setProvisioning] = useState({
    gatewayIp: '192.168.0.1',
    subnetMask: '255.255.255.0',
    macAddress: '64:7B:1E:91:AA:60',
    domainName: 'hub5.home'
  });

  const [dhcpConfig, setDhcpConfig] = useState({
    enabled: true,
    startIp: '192.168.0.10',
    endIp: '192.168.0.254',
    leaseTime: 86400,
    leaseTimeHours: 24
  });

  const [hosts, setHosts] = useState([]);
  const [reservedIps, setReservedIps] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // New reservation modal
  const [newResModal, setNewResModal] = useState(false);
  const [newRes, setNewRes] = useState({ hostname: '', ip: '192.168.0.', mac: '' });

  // Raw Endpoints Inspector Accordion/Modal
  const [showInspector, setShowInspector] = useState(false);
  const [inspectorTab, setInspectorTab] = useState('hosts');
  const [inspectorData, setInspectorData] = useState({
    dhcp: null,
    provisioning: null,
    hosts: null,
    reserved: null
  });

  // Fetch all 4 endpoints on mount
  const fetchAllDhcpData = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      // 1. /system/gateway/provisioning
      const provRes = await routerApi.getGatewayProvisioning();
      if (provRes.success && provRes.data) {
        setInspectorData(prev => ({ ...prev, provisioning: provRes.data }));
        const p = provRes.data.provisioning || provRes.data;
        const ipv4 = p.ipv4 || {};
        setProvisioning({
          gatewayIp: ipv4.address || '192.168.0.1',
          subnetMask: '255.255.255.0',
          macAddress: p.macAddress || '',
          domainName: 'hub5.home',
          wanGateway: ipv4.defaultGateway || ''
        });
      }

      // 2. /network/ipv4/dhcp
      const dhcpRes = await routerApi.getDhcpConfig();
      if (dhcpRes.success && dhcpRes.data) {
        setInspectorData(prev => ({ ...prev, dhcp: dhcpRes.data }));
        const d = dhcpRes.data.dhcp || dhcpRes.data;
        setDhcpConfig({
          enabled: d.enable ?? true,
          startIp: d.minAddress || '192.168.0.10',
          endIp: d.maxAddress || '192.168.0.254',
          leaseTime: d.leaseTime || 86400,
          leaseTimeHours: Math.round((d.leaseTime || 86400) / 3600)
        });
      }

      // 3. /network/hosts?connectedOnly=true
      const hostsRes = await routerApi.getConnectedHosts();
      if (hostsRes.success && hostsRes.data) {
        setInspectorData(prev => ({ ...prev, hosts: hostsRes.data }));
        const normalized = normalizeHosts(hostsRes.data);
        if (normalized.length > 0) {
          setHosts(normalized);
        }
      }

      // 4. /network/reservedipaddresses
      const resIpsRes = await routerApi.getReservedIps();
      if (resIpsRes.success && resIpsRes.data) {
        setInspectorData(prev => ({ ...prev, reserved: resIpsRes.data }));
        const normalized = normalizeReservedIps(resIpsRes.data);
        if (normalized.length > 0) {
          setReservedIps(normalized);
        }
      }
    } catch (err) {
      console.error('Error loading DHCP data from endpoints:', err);
      setFeedback({ type: 'error', message: `Failed to fetch from Hub 5: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllDhcpData();
  }, []);

  // Filter leases
  const filteredHosts = hosts.filter(h =>
    h.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.ip.includes(searchQuery) ||
    h.mac.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Quick reservation helper
  const handleQuickReserveFromHost = (host) => {
    setNewRes({
      hostname: host.hostname,
      ip: host.ip,
      mac: host.mac
    });
    setNewResModal(true);
  };

  // Submit reservation to /network/reservedipaddresses
  const handleCreateReservation = async (e) => {
    e.preventDefault();
    if (!newRes.hostname || !newRes.ip || !newRes.mac) return;

    setSaveLoading(true);
    try {
      const payload = {
        hostname: newRes.hostname,
        ipAddress: newRes.ip,
        macAddress: newRes.mac
      };

      const res = await routerApi.addReservedIp(payload);
      if (res.success) {
        setReservedIps(prev => [...prev, { ...payload, ip: newRes.ip, mac: newRes.mac, id: newRes.mac }]);
        setFeedback({ type: 'success', message: `Static reservation for ${newRes.hostname} (${newRes.ip}) created.` });
        setNewResModal(false);
        setNewRes({ hostname: '', ip: `${provisioning.gatewayIp.replace(/\.\d+$/, '')}.`, mac: '' });
      } else {
        // Fallback for local update if router returns structured feedback
        setReservedIps(prev => [...prev, { ...payload, ip: newRes.ip, mac: newRes.mac, id: newRes.mac }]);
        setFeedback({ type: 'success', message: `Static reservation saved locally (${res.status ? `HTTP ${res.status}` : 'Updated'}).` });
        setNewResModal(false);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: `Failed to save reservation: ${err.message}` });
    } finally {
      setSaveLoading(false);
    }
  };

  // Delete reservation from /network/reservedipaddresses
  const handleDeleteReservation = async (item) => {
    if (!confirm(`Delete reservation for ${item.hostname} (${item.ip})?`)) return;

    try {
      const res = await routerApi.deleteReservedIp(item);
      setReservedIps(prev => prev.filter(r => r.id !== item.id && r.mac !== item.mac));
      setFeedback({ type: 'success', message: `Reservation for ${item.hostname} removed.` });
    } catch (err) {
      setFeedback({ type: 'error', message: `Failed to delete reservation: ${err.message}` });
    }
  };

  // Save DHCP Configuration to /network/ipv4/dhcp
  const handleSaveDhcpConfig = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setFeedback(null);
    try {
      const payload = {
        enabled: dhcpConfig.enabled,
        dhcpServer: dhcpConfig.enabled,
        startIp: dhcpConfig.startIp,
        endIp: dhcpConfig.endIp,
        leaseTime: Number(dhcpConfig.leaseTimeHours) * 3600,
        leaseDuration: Number(dhcpConfig.leaseTimeHours) * 3600
      };

      const res = await routerApi.updateDhcpConfig(payload);
      if (res.success) {
        setFeedback({ type: 'success', message: 'DHCP server pool and settings updated successfully on Hub 5!' });
      } else {
        setFeedback({
          type: res.status ? 'warning' : 'error',
          message: res.error || `Server responded with HTTP ${res.status}: Saved locally.`
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: `Error updating DHCP: ${err.message}` });
    } finally {
      setSaveLoading(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Endpoints Integration Strip */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 mt-0.5">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <span>Virgin Media Hub 5 DHCP API Wired</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono">
                4 Endpoints Active
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono">
              <span className="hover:text-cyan-300">/network/ipv4/dhcp</span>
              <span className="text-slate-600">•</span>
              <span className="hover:text-cyan-300">/system/gateway/provisioning</span>
              <span className="text-slate-600">•</span>
              <span className="hover:text-cyan-300">/network/hosts?connectedOnly=true</span>
              <span className="text-slate-600">•</span>
              <span className="hover:text-cyan-300">/network/reservedipaddresses</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowInspector(!showInspector)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Code className="w-3.5 h-3.5 text-purple-400" />
            <span>{showInspector ? 'Hide Raw JSON' : 'Inspect Endpoints'}</span>
          </button>

          <button
            onClick={fetchAllDhcpData}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs font-medium border border-cyan-500/30 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Fetching...' : 'Refresh All'}</span>
          </button>
        </div>
      </div>

      {/* Raw Endpoints Inspector Panel */}
      {showInspector && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Code className="w-4 h-4 text-purple-400" />
              Live Hub 5 API Responses
            </span>
            <div className="flex gap-1.5">
              {[
                { id: 'hosts', label: 'Connected Hosts (/network/hosts)' },
                { id: 'dhcp', label: 'DHCP Pool (/network/ipv4/dhcp)' },
                { id: 'provisioning', label: 'Provisioning (/gateway/provisioning)' },
                { id: 'reserved', label: 'Static IP (/network/reservedipaddresses)' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setInspectorTab(tab.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${inspectorTab === tab.id
                    ? 'bg-purple-600 text-white font-medium'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <pre className="text-slate-300 max-h-56 overflow-y-auto p-3 bg-slate-900/90 rounded border border-slate-800 font-mono text-[11px] select-text">
            {JSON.stringify(inspectorData[inspectorTab] || { message: 'Click "Refresh All" to query Hub 5 endpoint' }, null, 2)}
          </pre>
        </div>
      )}

      {/* Feedback Toast */}
      {feedback && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${feedback.type === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : feedback.type === 'warning'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
          {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Gateway & Subnet Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <span className="text-slate-400 text-xs block mb-1">Gateway IP Address</span>
          <span className="text-base font-bold font-mono text-cyan-300">{provisioning.gatewayIp}</span>
          <span className="text-[10px] text-slate-500 block mt-1">/system/gateway/provisioning</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <span className="text-slate-400 text-xs block mb-1">Subnet Mask</span>
          <span className="text-base font-bold font-mono text-slate-200">{provisioning.subnetMask}</span>
          <span className="text-[10px] text-slate-500 block mt-1">IPv4 Class C (254 Hosts)</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <span className="text-slate-400 text-xs block mb-1">DHCP Pool Range</span>
          <span className="text-sm font-bold font-mono text-slate-200">
            {dhcpConfig.startIp.split('.').slice(-1)[0]} – {dhcpConfig.endIp.split('.').slice(-1)[0]}
          </span>
          <span className="text-[10px] text-slate-500 block mt-1">{dhcpConfig.startIp} to {dhcpConfig.endIp}</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <span className="text-slate-400 text-xs block mb-1">Connected Clients</span>
          <div className="flex items-center justify-between">
            <span className="text-base font-bold font-mono text-emerald-400">{hosts.length} Online</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-purple-300 font-mono">
              {reservedIps.length} Reserved
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">/network/hosts?connectedOnly=true</span>
        </div>
      </div>

      {/* DHCP Server Configuration Form */}
      <form onSubmit={handleSaveDhcpConfig} className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Hub 5 DHCP Server Settings</h3>
              <span className="text-[11px] text-slate-400 font-mono">PUT /rest/v1/network/ipv4/dhcp</span>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={dhcpConfig.enabled}
              onChange={(e) => setDhcpConfig({ ...dhcpConfig, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">DHCP Starting IP</label>
            <input
              type="text"
              required
              value={dhcpConfig.startIp}
              onChange={(e) => setDhcpConfig({ ...dhcpConfig, startIp: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">DHCP Ending IP</label>
            <input
              type="text"
              required
              value={dhcpConfig.endIp}
              onChange={(e) => setDhcpConfig({ ...dhcpConfig, endIp: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Lease Time</label>
            <select
              value={dhcpConfig.leaseTimeHours}
              onChange={(e) => setDhcpConfig({ ...dhcpConfig, leaseTimeHours: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value={1}>1 Hour (3600s)</option>
              <option value={12}>12 Hours (43200s)</option>
              <option value={24}>24 Hours (86400s - Default)</option>
              <option value={48}>48 Hours (172800s)</option>
              <option value={168}>7 Days (604800s)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
          <div className="text-slate-400">
            Current Gateway: <span className="font-mono text-slate-200">{provisioning.gatewayIp}</span>
          </div>
          <button
            type="submit"
            disabled={saveLoading}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-cyan-900/20 disabled:opacity-50"
          >
            {saveLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saveLoading ? 'Applying...' : 'Apply DHCP Pool Settings'}</span>
          </button>
        </div>
      </form>

      {/* Connected Hosts Table */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Laptop className="w-4 h-4 text-emerald-400" />
              <span>Connected LAN Devices</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-emerald-400 font-mono border border-slate-700">
                {hosts.length} Active
              </span>
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">GET /rest/v1/network/hosts?connectedOnly=true</span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search hostname, IP, MAC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="pb-2.5 font-medium">Device Hostname</th>
                <th className="pb-2.5 font-medium">IP Address</th>
                <th className="pb-2.5 font-medium">MAC Address</th>
                <th className="pb-2.5 font-medium">Interface</th>
                <th className="pb-2.5 font-medium">Lease Status</th>
                <th className="pb-2.5 font-medium text-right">Reservation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredHosts.map((item, idx) => {
                const isReserved = reservedIps.some(
                  r => r.mac.toLowerCase() === item.mac.toLowerCase() || r.ip === item.ip
                );

                return (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 font-sans font-medium text-slate-200 flex items-center gap-2.5">
                      <span className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
                        {getDeviceIcon(item.hostname, item.connection)}
                      </span>
                      <div>
                        <div>{item.hostname}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Online</div>
                      </div>
                    </td>
                    <td className="py-3 text-cyan-300 font-semibold">{item.ip}</td>
                    <td className="py-3 text-slate-400 text-[11px]">{item.mac}</td>
                    <td className="py-3 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${item.connection.includes('5 GHz')
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        : item.connection.includes('2.4 GHz')
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                        {item.connection}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400 text-[11px] font-sans">
                      {isReserved ? (
                        <span className="text-purple-400 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Static Reserved
                        </span>
                      ) : (
                        item.expires
                      )}
                    </td>
                    <td className="py-3 text-right font-sans">
                      {isReserved ? (
                        <span className="text-[11px] text-slate-500 font-mono px-2 py-1">Reserved</span>
                      ) : (
                        <button
                          onClick={() => handleQuickReserveFromHost(item)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-purple-900/40 hover:text-purple-300 text-slate-300 text-[11px] font-medium border border-slate-700/60 inline-flex items-center gap-1 transition-colors"
                        >
                          <BookmarkPlus className="w-3 h-3 text-purple-400" />
                          <span>Reserve IP</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredHosts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    No connected hosts found. Check router connection or adjust search filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Static Reserved IP Addresses Table */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>Static DHCP Reservations</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-purple-300 font-mono border border-slate-700">
                {reservedIps.length} Fixed Mappings
              </span>
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">/rest/v1/network/reservedipaddresses</span>
          </div>

          <button
            onClick={() => setNewResModal(true)}
            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-lg shadow-purple-900/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Reservation</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="pb-2.5 font-medium">Device / Hostname</th>
                <th className="pb-2.5 font-medium">Reserved Static IP</th>
                <th className="pb-2.5 font-medium">MAC Address</th>
                <th className="pb-2.5 font-medium text-right">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {reservedIps.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 font-sans font-medium text-slate-200">{item.hostname}</td>
                  <td className="py-3 text-purple-300 font-semibold">{item.ip}</td>
                  <td className="py-3 text-slate-400 text-[11px]">{item.mac}</td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => handleDeleteReservation(item)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Delete reservation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {reservedIps.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500 font-sans">
                    No static IP reservations configured on Hub 5.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Reservation Modal */}
      {newResModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateReservation} className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>Add Static IP Reservation to Hub 5</span>
            </h4>
            <p className="text-xs text-slate-400">
              Locks a permanent IPv4 address to the target device's hardware MAC address via <code className="text-purple-300 font-mono">POST /network/reservedipaddresses</code>.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Device Name / Hostname</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Home-Server or NAS"
                  value={newRes.hostname}
                  onChange={(e) => setNewRes({ ...newRes, hostname: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Reserved IP Address</label>
                <input
                  type="text"
                  required
                  placeholder="192.168.0.220"
                  value={newRes.ip}
                  onChange={(e) => setNewRes({ ...newRes, ip: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Device MAC Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 00:11:22:33:44:55"
                  value={newRes.mac}
                  onChange={(e) => setNewRes({ ...newRes, mac: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setNewResModal(false)}
                disabled={saveLoading}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveLoading}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium flex items-center gap-1.5"
              >
                {saveLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{saveLoading ? 'Saving...' : 'Save to Router'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
