import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Radio,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  AlertCircle,
  Shield,
  Layers,
  Activity,
  Globe2,
  Lock,
  Zap,
  ArrowRight,
  Info
} from 'lucide-react';
import { routerApi } from '../../services/routerApi.js';

export default function PortForwardingPage({ routerStatus }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  // States
  const [rules, setRules] = useState([]);
  const [upnpEnabled, setUpnpEnabled] = useState(false);
  const [dmzState, setDmzState] = useState({ enable: false, internalIp: '192.168.0.0' });
  const [v4Firewall, setV4Firewall] = useState({
    enable: true,
    blockFragmentedIpPackets: false,
    portScanProtect: true,
    ipFloodDetect: true
  });
  const [v6Firewall, setV6Firewall] = useState({
    enable: true,
    blockFragmentedIpPackets: false,
    portScanProtect: true,
    ipFloodDetect: true
  });

  // Modal for Adding Rule
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRule, setNewRule] = useState({
    name: 'Custom Service',
    protocol: 'tcp',
    externalStartPort: '',
    externalEndPort: '',
    localStartPort: '',
    localEndPort: '',
    localAddress: '192.168.0.'
  });

  const fetchData = async () => {
    try {
      setError(null);
      const [pfRes, upnpRes, dmzRes, fwRes] = await Promise.all([
        routerApi.getPortForwarding(),
        routerApi.getUpnp(),
        routerApi.getDmz(),
        routerApi.getFirewall()
      ]);

      if (pfRes.data?.portforwarding?.rules) {
        setRules(pfRes.data.portforwarding.rules);
      }
      if (upnpRes.data?.upnp) {
        setUpnpEnabled(Boolean(upnpRes.data.upnp.enable));
      }
      if (dmzRes.data?.dmz) {
        setDmzState(dmzRes.data.dmz);
      }
      if (fwRes.ipv4?.data?.firewall) {
        setV4Firewall(fwRes.ipv4.data.firewall);
      }
      if (fwRes.ipv6?.data?.firewall) {
        setV6Firewall(fwRes.ipv6.data.firewall);
      }
    } catch (err) {
      console.error('Failed to load port & firewall data:', err);
      setError(err.message || 'Error fetching router settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [routerStatus.authenticated]);

  const handleToggleUpnp = async () => {
    const next = !upnpEnabled;
    setUpnpEnabled(next);
    try {
      await routerApi.setUpnp(next);
      showFeedback('UPnP setting updated successfully');
    } catch (err) {
      setUpnpEnabled(!next);
      setError('Failed to update UPnP: ' + err.message);
    }
  };

  const handleToggleDmz = async (enabled) => {
    const updated = { ...dmzState, enable: enabled };
    setDmzState(updated);
    try {
      await routerApi.setDmz(updated);
      showFeedback(`DMZ Host ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      setDmzState({ ...dmzState, enable: !enabled });
      setError('Failed to update DMZ: ' + err.message);
    }
  };

  const handleSaveDmzIp = async (e) => {
    e.preventDefault();
    try {
      await routerApi.setDmz(dmzState);
      showFeedback('DMZ target IP saved');
    } catch (err) {
      setError('Failed to save DMZ IP: ' + err.message);
    }
  };

  const handleToggleFirewallOpt = async (version, field) => {
    if (version === 'v4') {
      const updated = { ...v4Firewall, [field]: !v4Firewall[field] };
      setV4Firewall(updated);
      try {
        await routerApi.setIpv4Firewall(updated);
        showFeedback(`IPv4 ${field} updated`);
      } catch (err) {
        setV4Firewall(v4Firewall);
        setError('Failed to update IPv4 firewall: ' + err.message);
      }
    } else {
      const updated = { ...v6Firewall, [field]: !v6Firewall[field] };
      setV6Firewall(updated);
      try {
        await routerApi.setIpv6Firewall(updated);
        showFeedback(`IPv6 ${field} updated`);
      } catch (err) {
        setV6Firewall(v6Firewall);
        setError('Failed to update IPv6 firewall: ' + err.message);
      }
    }
  };

  const handleDeleteRule = async (id) => {
    if (!confirm('Are you sure you want to delete this port forwarding rule?')) return;
    try {
      await routerApi.deletePortForwardingRule(id);
      setRules(rules.filter(r => r.id !== id));
      showFeedback('Port forwarding rule deleted');
    } catch (err) {
      setError('Failed to delete rule: ' + err.message);
    }
  };

  const handleAddRuleSubmit = async (e) => {
    e.preventDefault();
    const extStart = parseInt(newRule.externalStartPort, 10);
    const extEnd = parseInt(newRule.externalEndPort || newRule.externalStartPort, 10);
    const localStart = parseInt(newRule.localStartPort || newRule.externalStartPort, 10);
    const localEnd = parseInt(newRule.localEndPort || extEnd, 10);

    if (isNaN(extStart) || extStart < 1 || extStart > 65535) {
      alert('Invalid external port');
      return;
    }

    const payload = {
      enable: true,
      protocol: newRule.protocol,
      externalStartPort: extStart,
      externalEndPort: extEnd,
      localStartPort: localStart,
      localEndPort: localEnd,
      localAddress: newRule.localAddress
    };

    try {
      const res = await routerApi.savePortForwardingRule(payload);
      if (res.data?.created?.id) {
        setRules([...rules, { id: res.data.created.id, rule: payload }]);
      } else {
        await fetchData();
      }
      setShowAddModal(false);
      showFeedback('Port forwarding rule created');
      setNewRule({
        name: 'Custom Service',
        protocol: 'tcp',
        externalStartPort: '',
        externalEndPort: '',
        localStartPort: '',
        localEndPort: '',
        localAddress: '192.168.0.'
      });
    } catch (err) {
      setError('Failed to create rule: ' + err.message);
    }
  };

  const showFeedback = (msg) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            <span>Port Forwarding & Firewall</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage NAT port mappings, UPnP services, DMZ host, and hardware firewall filters.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => { setRefreshing(true); fetchData(); }}
            disabled={refreshing || loading}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/80 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-rose-950/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Port Rule</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{statusMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Cards: UPnP and DMZ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* UPnP Card */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Universal Plug and Play (UPnP)</h3>
                  <p className="text-[11px] text-slate-400">Allows game consoles and apps to automatically open ports.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleUpnp}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${upnpEnabled ? 'bg-rose-600' : 'bg-slate-700'
                  }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${upnpEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-slate-950/50 border border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Status:</span>
              <span className={`font-medium ${upnpEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                {upnpEnabled ? 'Enabled (Automatic NAT active)' : 'Disabled (Strict NAT)'}
              </span>
            </div>
          </div>
        </div>

        {/* DMZ Host Card */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Globe2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">DMZ Host (Demilitarized Zone)</h3>
                <p className="text-[11px] text-slate-400">Forwards all unmapped incoming traffic to a specific internal IP.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleDmz(!dmzState.enable)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${dmzState.enable ? 'bg-amber-600' : 'bg-slate-700'
                }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${dmzState.enable ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>

          <form onSubmit={handleSaveDmzIp} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={dmzState.internalIp}
              disabled={!dmzState.enable}
              onChange={(e) => setDmzState({ ...dmzState, internalIp: e.target.value })}
              placeholder="192.168.0.100"
              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-200 text-xs font-mono focus:border-amber-500 focus:outline-none disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={!dmzState.enable}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-40"
            >
              Save IP
            </button>
          </form>
        </div>
      </div>

      {/* Port Forwarding Table */}
      <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-rose-500" />
              <span>Active Port Forwarding Rules ({rules.length})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Rules routing external WAN ports directly to specific local LAN server IP addresses.
            </p>
          </div>
        </div>

        {rules.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            No active port forwarding rules configured.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80">
                <tr>
                  <th className="py-2.5 px-3">Rule ID</th>
                  <th className="py-2.5 px-3">External Port</th>
                  <th className="py-2.5 px-3">Protocol</th>
                  <th className="py-2.5 px-3">Local Address</th>
                  <th className="py-2.5 px-3">Local Port</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {rules.map((item) => {
                  const rule = item.rule || item;
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-400">#{item.id}</td>
                      <td className="py-3 px-3 font-mono font-medium text-slate-200">
                        {rule.externalStartPort}
                        {rule.externalEndPort && rule.externalEndPort !== rule.externalStartPort ? `-${rule.externalEndPort}` : ''}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase ${rule.protocol === 'tcp' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                          rule.protocol === 'udp' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}>
                          {rule.protocol || 'ALL'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">{rule.localAddress}</td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {rule.localStartPort}
                        {rule.localEndPort && rule.localEndPort !== rule.localStartPort ? `-${rule.localEndPort}` : ''}
                      </td>
                      <td className="py-3 px-3">
                        {rule.readOnly ? (
                          <span className="text-[10px] text-slate-500">System/UPnP</span>
                        ) : (
                          <span className="text-[10px] text-emerald-400">User Defined</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {!rule.readOnly && (
                          <button
                            onClick={() => handleDeleteRule(item.id)}
                            className="p-1 rounded hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Delete Rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hardware Firewall Toggles */}
      <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Built-in Firewall Protection</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure packet flood detection, port scan defense, and fragmentation checks on Hub 5 hardware.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* IPv4 Options */}
          <div className="p-4 rounded-lg bg-slate-950/40 border border-slate-800/60 space-y-3">
            <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider pb-1 border-b border-slate-800/60">
              IPv4 Firewall Options
            </div>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span>Firewall Master Protection</span>
              <input
                type="checkbox"
                checked={v4Firewall.enable}
                onChange={() => handleToggleFirewallOpt('v4', 'enable')}
                className="rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span>Port Scan Detection</span>
              <input
                type="checkbox"
                checked={v4Firewall.portScanProtect}
                onChange={() => handleToggleFirewallOpt('v4', 'portScanProtect')}
                className="rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span>IP Flood Detection (DoS Protect)</span>
              <input
                type="checkbox"
                checked={v4Firewall.ipFloodDetect}
                onChange={() => handleToggleFirewallOpt('v4', 'ipFloodDetect')}
                className="rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span>Block Fragmented IP Packets</span>
              <input
                type="checkbox"
                checked={v4Firewall.blockFragmentedIpPackets}
                onChange={() => handleToggleFirewallOpt('v4', 'blockFragmentedIpPackets')}
                className="rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500"
              />
            </label>
          </div>

          {/* IPv6 Options */}
          <div className="p-4 rounded-lg bg-slate-950/40 border border-slate-800/60 space-y-3">
            <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider pb-1 border-b border-slate-800/60">
              IPv6 Firewall Options
            </div>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span>Firewall Master Protection</span>
              <input
                type="checkbox"
                checked={v6Firewall.enable}
                onChange={() => handleToggleFirewallOpt('v6', 'enable')}
                className="rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span>Port Scan Detection</span>
              <input
                type="checkbox"
                checked={v6Firewall.portScanProtect}
                onChange={() => handleToggleFirewallOpt('v6', 'portScanProtect')}
                className="rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span>IP Flood Detection (DoS Protect)</span>
              <input
                type="checkbox"
                checked={v6Firewall.ipFloodDetect}
                onChange={() => handleToggleFirewallOpt('v6', 'ipFloodDetect')}
                className="rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span>Block Fragmented IP Packets</span>
              <input
                type="checkbox"
                checked={v6Firewall.blockFragmentedIpPackets}
                onChange={() => handleToggleFirewallOpt('v6', 'blockFragmentedIpPackets')}
                className="rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Add Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-rose-500" />
                <span>Add Port Forwarding Rule</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddRuleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Protocol</label>
                <select
                  value={newRule.protocol}
                  onChange={(e) => setNewRule({ ...newRule, protocol: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-rose-500 focus:outline-none"
                >
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                  <option value="both">Both (TCP/UDP)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">External Start Port</label>
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    required
                    value={newRule.externalStartPort}
                    onChange={(e) => setNewRule({ ...newRule, externalStartPort: e.target.value })}
                    placeholder="e.g. 8080"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-rose-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">External End Port</label>
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    value={newRule.externalEndPort}
                    onChange={(e) => setNewRule({ ...newRule, externalEndPort: e.target.value })}
                    placeholder="e.g. 8080"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-rose-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Local IP Address</label>
                <input
                  type="text"
                  required
                  value={newRule.localAddress}
                  onChange={(e) => setNewRule({ ...newRule, localAddress: e.target.value })}
                  placeholder="192.168.0.150"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-rose-500 focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Local Start Port</label>
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    value={newRule.localStartPort}
                    onChange={(e) => setNewRule({ ...newRule, localStartPort: e.target.value })}
                    placeholder="Leave blank for same"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-rose-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Local End Port</label>
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    value={newRule.localEndPort}
                    onChange={(e) => setNewRule({ ...newRule, localEndPort: e.target.value })}
                    placeholder="Leave blank for same"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:border-rose-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-lg shadow-rose-950/40 transition-colors"
                >
                  Create Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

