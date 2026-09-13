import React, { useState, useEffect } from 'react';
import {
  Globe,
  ShieldCheck,
  Save,
  Check,
  Info,
  Zap,
  Server,
  RefreshCw,
  AlertCircle,
  Code,
  Lock,
  ArrowRight
} from 'lucide-react';
import { routerApi } from '../../services/routerApi.js';

export default function DnsPage({ onSendRequest }) {
  // Live ISP DNS from /system/gateway/provisioning
  const [ispDns, setIspDns] = useState(['194.168.4.100', '194.168.8.100']);

  // DNS form state mapped exactly to Hub 5 payload
  const [dnsMode, setDnsMode] = useState('default'); // 'default' or 'custom'
  const [ipv4Primary, setIpv4Primary] = useState('1.1.1.1');
  const [ipv4Secondary, setIpv4Secondary] = useState('1.0.0.1');
  const [ipv6Primary, setIpv6Primary] = useState('');
  const [ipv6Secondary, setIpv6Secondary] = useState('');

  // Hub 5 screen capability flag from /system/ui/screens
  const [isDnsEditableOnRouter, setIsDnsEditableOnRouter] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Inspector
  const [showInspector, setShowInspector] = useState(false);
  const [inspectorData, setInspectorData] = useState({
    dns: null,
    provisioning: null,
    screens: null
  });

  const presets = [
    { name: 'Cloudflare', primary: '1.1.1.1', secondary: '1.0.0.1', v6p: '2606:4700:4700::1111', v6s: '2606:4700:4700::1001' },
    { name: 'Google DNS', primary: '8.8.8.8', secondary: '8.8.4.4', v6p: '2001:4860:4860::8888', v6s: '2001:4860:4860::8844' },
    { name: 'Quad9 Secure', primary: '9.9.9.9', secondary: '149.112.112.112', v6p: '2620:fe::fe', v6s: '2620:fe::9' },
    { name: 'AdGuard Ad-Block', primary: '94.140.14.14', secondary: '94.140.15.15', v6p: '2a10:50c0::ad1:ff', v6s: '2a10:50c0::ad2:ff' }
  ];

  const fetchDnsData = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      // 1. Get live ISP DNS from gateway provisioning
      const provRes = await routerApi.getGatewayProvisioning();
      if (provRes.success && provRes.data) {
        setInspectorData(prev => ({ ...prev, provisioning: provRes.data }));
        const dnsList = provRes.data.provisioning?.ipv4?.dnsServers;
        if (Array.isArray(dnsList) && dnsList.length > 0) {
          setIspDns(dnsList);
        }
      }

      // 2. Check screens capability from /system/ui/screens
      const screensRes = await routerApi.getScreenCapabilities();
      if (screensRes.success && screensRes.data) {
        setInspectorData(prev => ({ ...prev, screens: screensRes.data }));
        const dnsDisplay = screensRes.data.screens?.dns?.display;
        setIsDnsEditableOnRouter(Boolean(dnsDisplay));
      }

      // 3. Query /network/dns
      const dnsRes = await routerApi.getDnsConfig();
      if (dnsRes.success && dnsRes.data) {
        setInspectorData(prev => ({ ...prev, dns: dnsRes.data }));
        const d = dnsRes.data.dns || dnsRes.data;
        if (d.overridden) {
          setDnsMode('custom');
          setIpv4Primary(d.ipv4?.primary || '1.1.1.1');
          setIpv4Secondary(d.ipv4?.secondary || '1.0.0.1');
          setIpv6Primary(d.ipv6?.primary || '');
          setIpv6Secondary(d.ipv6?.secondary || '');
        } else {
          setDnsMode('default');
        }
      }
    } catch (err) {
      console.error('Failed to load DNS data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDnsData();
  }, []);

  const handleApplyPreset = (preset) => {
    setDnsMode('custom');
    setIpv4Primary(preset.primary);
    setIpv4Secondary(preset.secondary);
    if (preset.v6p) setIpv6Primary(preset.v6p);
    if (preset.v6s) setIpv6Secondary(preset.v6s);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      // Construct exact payload required by Hub 5 firmware
      let payload;
      if (dnsMode === 'default') {
        payload = {
          dns: {
            overridden: false
          }
        };
      } else {
        payload = {
          dns: {
            overridden: true,
            ipv4: {
              primary: ipv4Primary,
              secondary: ipv4Secondary
            },
            ipv6: {
              primary: ipv6Primary || '',
              secondary: ipv6Secondary || ''
            }
          }
        };
      }

      const res = await routerApi.updateDnsConfig(payload);
      if (res.status === 503 || res.data?.errorCode === 9) {
        setFeedback({
          type: 'warning',
          message: 'Virgin Media Hub 5 Firmware Restriction: DNS override is disabled on residential DOCSIS firmware (HTTP 503 Service Not Available). Virgin Media locks DNS to ISP servers (194.168.4.100 / 194.168.8.100). To use custom DNS, configure resolvers on client devices or put Hub 5 in Modem Mode with your own router.'
        });
      } else if (res.success || (res.status >= 200 && res.status < 300)) {
        setFeedback({ type: 'success', message: 'DNS configuration updated successfully on Virgin Media Hub 5!' });
        await fetchDnsData();
      } else {
        setFeedback({
          type: 'error',
          message: res.error || res.data?.message || `Server responded with status ${res.status || 'unknown'}`
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: `Request failed: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Firmware Feature Status Strip */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 mt-0.5">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <span>Virgin Media Hub 5 DNS Resolver</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${isDnsEditableOnRouter
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                {isDnsEditableOnRouter ? 'Override Enabled' : 'ISP Managed (DOCSIS)'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono">
              <span className="text-slate-300">GET /rest/v1/network/dns</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">PUT /rest/v1/network/dns</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">GET /rest/v1/system/gateway/provisioning</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowInspector(!showInspector)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Code className="w-3.5 h-3.5 text-purple-400" />
            <span>{showInspector ? 'Hide Raw JSON' : 'Inspect Endpoints'}</span>
          </button>

          <button
            onClick={fetchDnsData}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-medium border border-emerald-500/30 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Querying...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Raw Inspector */}
      {showInspector && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <Code className="w-4 h-4 text-purple-400" />
            <span>Hub 5 Live DNS Responses</span>
          </div>
          <pre className="text-slate-300 max-h-56 overflow-y-auto p-3 bg-slate-900/90 rounded border border-slate-800 font-mono text-[11px] select-text">
            {JSON.stringify(inspectorData, null, 2)}
          </pre>
        </div>
      )}

      {/* Toast */}
      {feedback && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${feedback.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : feedback.type === 'warning'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
          {feedback.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Active ISP Resolvers Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Primary Virgin Media DNS</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Assigned via DOCSIS
            </span>
          </div>
          <div className="text-base font-bold font-mono text-emerald-300">
            {ispDns[0] || '194.168.4.100'}
          </div>
          <span className="text-[10px] text-slate-500 block">Virgin Media Broadband UK Relay</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Secondary Virgin Media DNS</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Assigned via DOCSIS
            </span>
          </div>
          <div className="text-base font-bold font-mono text-emerald-300">
            {ispDns[1] || '194.168.8.100'}
          </div>
          <span className="text-[10px] text-slate-500 block">Virgin Media Broadband Backup Relay</span>
        </div>
      </div>

      {/* Firmware Limitation Notice */}
      {!isDnsEditableOnRouter && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5">
          <div className="font-semibold flex items-center gap-2 text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Firmware Notice: DNS Overriding Disabled by Virgin Media</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            Your Hub 5 reports <code className="text-amber-300 bg-amber-950/60 px-1 py-0.5 rounded font-mono">screens.dns.display: false</code> and rejects changes with <code className="text-amber-300 bg-amber-950/60 px-1 py-0.5 rounded font-mono">503 Service not available! (errorCode: 9)</code>. On Virgin Media UK residential firmware, DNS servers are enforced via DOCSIS provisioning.
          </p>
          <p className="text-slate-400 text-[11px] leading-relaxed pt-1">
            <strong>Workaround:</strong> To use Cloudflare/Google/AdGuard DNS on your network, configure custom DNS resolvers directly in your client device's network settings (macOS, Windows, iOS, Android), or enable <strong>Modem Mode</strong> in Settings to pair the Hub 5 with your own router.
          </p>
        </div>
      )}

      {/* Configuration Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>DNS Resolution Mode</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select whether the Hub 5 and connected LAN devices use default Virgin Media DNS or custom resolvers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mode 1: Default (ISP) */}
            <label className={`p-4 rounded-xl border cursor-pointer transition-all ${dnsMode === 'default'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-100'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="dnsMode"
                    value="default"
                    checked={dnsMode === 'default'}
                    onChange={() => setDnsMode('default')}
                    className="text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-xs text-slate-200">Default (Virgin Media ISP)</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  overridden: false
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed pl-5">
                Routes domain lookups through Virgin Media's low-latency regional recursive DNS servers ({ispDns.join(', ')}).
              </p>
            </label>

            {/* Mode 2: Custom */}
            <label className={`p-4 rounded-xl border cursor-pointer transition-all ${dnsMode === 'custom'
                ? 'bg-rose-500/10 border-rose-500/40 text-slate-100'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="dnsMode"
                    value="custom"
                    checked={dnsMode === 'custom'}
                    onChange={() => setDnsMode('custom')}
                    className="text-rose-500 focus:ring-rose-500"
                  />
                  <span className="font-semibold text-xs text-slate-200">Custom DNS Resolvers</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  overridden: true
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed pl-5">
                Override ISP DNS with third-party providers (Cloudflare, Google, Quad9, AdGuard) or a local Pi-hole.
              </p>
            </label>
          </div>

          {/* Custom Form Fields */}
          {dnsMode === 'custom' && (
            <div className="pt-4 border-t border-slate-800 space-y-4">
              <div>
                <span className="text-xs text-slate-400 font-medium block mb-2">1-Click Presets:</span>
                <div className="flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>{p.name}</span>
                      <span className="text-[10px] font-mono text-slate-500">({p.primary})</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Primary IPv4 DNS (Preferred)</label>
                  <input
                    type="text"
                    required
                    value={ipv4Primary}
                    onChange={(e) => setIpv4Primary(e.target.value)}
                    placeholder="1.1.1.1"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Secondary IPv4 DNS (Alternate)</label>
                  <input
                    type="text"
                    required
                    value={ipv4Secondary}
                    onChange={(e) => setIpv4Secondary(e.target.value)}
                    placeholder="1.0.0.1"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Primary IPv6 DNS (Optional)</label>
                  <input
                    type="text"
                    value={ipv6Primary}
                    onChange={(e) => setIpv6Primary(e.target.value)}
                    placeholder="2606:4700:4700::1111"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Secondary IPv6 DNS (Optional)</label>
                  <input
                    type="text"
                    value={ipv6Secondary}
                    onChange={(e) => setIpv6Secondary(e.target.value)}
                    placeholder="2606:4700:4700::1001"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
            <span className="text-slate-500 font-mono text-[11px]">
              Payload: PUT /rest/v1/network/dns
            </span>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-colors disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Applying to Hub 5...' : 'Apply DNS Settings'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
