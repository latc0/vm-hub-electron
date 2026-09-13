import React, { useState, useEffect } from 'react';
import {
  Wifi,
  Shield,
  Eye,
  EyeOff,
  Save,
  Radio,
  Users,
  Info,
  Check,
  Cpu,
  SlidersHorizontal,
  ChevronDown,
  RefreshCw,
  Code,
  AlertCircle,
  Zap,
  Lock
} from 'lucide-react';
import { routerApi } from '../../services/routerApi.js';

export default function WifiPage() {
  // Smart Mode (Band Steering)
  const [smartMode, setSmartMode] = useState(true);
  const [smartWifiEditable, setSmartWifiEditable] = useState(true);

  // 2.4 GHz configuration
  const [band2g, setBand2g] = useState({
    enable: true,
    ssid: 'VM3277742',
    broadcastSsid: true,
    securityType: 'wpa2_psk_wpa3_sae',
    passphrase: '',
    channelMode: false, // false = manual, true = auto
    channelNumber: 11,
    channelWidth: '20mhz',
    mode: 'g_n_ax'
  });

  // 5 GHz configuration
  const [band5g, setBand5g] = useState({
    enable: true,
    ssid: 'VM3277742',
    broadcastSsid: true,
    securityType: 'wpa2_psk_wpa3_sae',
    passphrase: '',
    channelMode: false,
    channelNumber: 108,
    channelWidth: '80mhz',
    mode: 'a_n_ac_ax'
  });

  // Guest Wi-Fi configuration
  const [guestConfig, setGuestConfig] = useState({
    enable: false,
    ssid: 'VM-guest3277742',
    broadcastSsid: true,
    securityType: 'wpa2_psk',
    passphrase: ''
  });

  // Capabilities from router
  const [capabilities, setCapabilities] = useState({
    band2g: { supportedChannels: [1, 6, 11], supportedChannelWidths: ['20mhz', '40mhz'] },
    band5g: { supportedChannels: [36, 40, 44, 48, 108], supportedChannelWidths: ['20mhz', '40mhz', '80mhz', '160mhz'] }
  });

  const [showPassword24, setShowPassword24] = useState(false);
  const [showPassword5, setShowPassword5] = useState(false);
  const [showGuestPassword, setShowGuestPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Raw Inspector
  const [showInspector, setShowInspector] = useState(false);
  const [inspectorData, setInspectorData] = useState({});

  // Fetch all live Wi-Fi endpoints from Hub 5
  const fetchWifiData = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const [capsRes, smartRes, b2Res, b5Res, guestRes] = await Promise.all([
        routerApi.getWifiCapabilities(),
        routerApi.getWifiSmartMode(),
        routerApi.getWifiBand2gConfig(),
        routerApi.getWifiBand5gConfig(),
        routerApi.getWifiGuestConfig()
      ]);

      setInspectorData({
        capabilities: capsRes.data,
        smartmode: smartRes.data,
        band2g: b2Res.data,
        band5g: b5Res.data,
        guest: guestRes.data
      });

      if (capsRes.success && capsRes.data?.capabilities) {
        setCapabilities(capsRes.data.capabilities);
      }

      if (smartRes.success && smartRes.data?.smartmode) {
        setSmartMode(Boolean(smartRes.data.smartmode.enable));
        setSmartWifiEditable(Boolean(smartRes.data.smartWifiEditable));
      }

      if (b2Res.success && b2Res.data?.config) {
        const c = b2Res.data.config;
        setBand2g({
          enable: Boolean(c.enable),
          ssid: c.ssid?.ssid || 'VM3277742',
          broadcastSsid: c.ssid?.broadcastSsid !== false,
          securityType: c.ssid?.securityType || 'wpa2_psk_wpa3_sae',
          passphrase: c.ssid?.passphrase || '',
          channelMode: Boolean(c.radio?.channelMode),
          channelNumber: c.radio?.channelNumber || 11,
          channelWidth: c.radio?.channelWidth || '20mhz',
          mode: c.radio?.mode || 'g_n_ax'
        });
      }

      if (b5Res.success && b5Res.data?.config) {
        const c = b5Res.data.config;
        setBand5g({
          enable: Boolean(c.enable),
          ssid: c.ssid?.ssid || 'VM3277742',
          broadcastSsid: c.ssid?.broadcastSsid !== false,
          securityType: c.ssid?.securityType || 'wpa2_psk_wpa3_sae',
          passphrase: c.ssid?.passphrase || '',
          channelMode: Boolean(c.radio?.channelMode),
          channelNumber: c.radio?.channelNumber || 108,
          channelWidth: c.radio?.channelWidth || '80mhz',
          mode: c.radio?.mode || 'a_n_ac_ax'
        });
      }

      if (guestRes.success && guestRes.data?.config) {
        const c = guestRes.data.config;
        setGuestConfig({
          enable: Boolean(c.enable),
          ssid: c.ssid?.ssid || 'VM-guest3277742',
          broadcastSsid: c.ssid?.broadcastSsid !== false,
          securityType: c.ssid?.securityType || 'wpa2_psk',
          passphrase: c.ssid?.passphrase || ''
        });
      }
    } catch (err) {
      console.error('Failed to load Wi-Fi configs:', err);
      setFeedback({ type: 'error', message: `Failed to load Wi-Fi config: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWifiData();
  }, []);

  // Handle Smart Mode (Band Steering) Toggle
  const handleToggleSmartMode = async (enable) => {
    setSmartMode(enable);
    if (enable) {
      // Synchronize SSIDs and passwords
      setBand5g(prev => ({
        ...prev,
        ssid: band2g.ssid,
        passphrase: band2g.passphrase,
        securityType: band2g.securityType
      }));
    }
    try {
      await routerApi.updateWifiSmartMode(enable);
      setFeedback({ type: 'success', message: `Smart Wi-Fi (Band Steering) ${enable ? 'enabled' : 'disabled'}.` });
    } catch (err) {
      setFeedback({ type: 'error', message: `Could not toggle Smart Wi-Fi: ${err.message}` });
    }
  };

  // Save Wi-Fi Configuration
  const handleSaveAll = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const promises = [];

      // 1. Smart Mode
      promises.push(routerApi.updateWifiSmartMode(smartMode));

      // 2. 2.4 GHz Band config payload for PATCH /rest/v1/wifi/band2g/config
      const payload2g = {
        config: {
          enable: band2g.enable,
          ssid: {
            ssid: band2g.ssid,
            broadcastSsid: band2g.broadcastSsid,
            securityType: band2g.securityType,
            passphrase: band2g.passphrase
          },
          radio: {
            channelMode: band2g.channelMode,
            channelNumber: Number(band2g.channelNumber),
            channelWidth: band2g.channelWidth
          }
        }
      };
      promises.push(routerApi.updateWifiBandConfig('band2g', payload2g));

      // 3. 5 GHz Band config payload for PATCH /rest/v1/wifi/band5g/config
      const payload5g = {
        config: {
          enable: band5g.enable,
          ssid: {
            ssid: smartMode ? band2g.ssid : band5g.ssid,
            broadcastSsid: band5g.broadcastSsid,
            securityType: smartMode ? band2g.securityType : band5g.securityType,
            passphrase: smartMode ? band2g.passphrase : band5g.passphrase
          },
          radio: {
            channelMode: band5g.channelMode,
            channelNumber: Number(band5g.channelNumber),
            channelWidth: band5g.channelWidth
          }
        }
      };
      promises.push(routerApi.updateWifiBandConfig('band5g', payload5g));

      // 4. Guest Wi-Fi
      const guestPayload = {
        config: {
          enable: guestConfig.enable,
          ssid: {
            ssid: guestConfig.ssid,
            broadcastSsid: guestConfig.broadcastSsid,
            securityType: guestConfig.securityType,
            passphrase: guestConfig.passphrase
          }
        }
      };
      promises.push(routerApi.updateWifiGuestConfig(guestPayload));

      await Promise.all(promises);
      setFeedback({ type: 'success', message: 'Wi-Fi settings applied successfully to Virgin Media Hub 5!' });
    } catch (err) {
      setFeedback({ type: 'error', message: `Failed to update Wi-Fi: ${err.message}` });
    } finally {
      setIsSaving(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Endpoints Status Strip */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 mt-0.5">
            <Wifi className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <span>Virgin Media Hub 5 Wi-Fi 6 (802.11ax) Wired</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono">
                Active
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono">
              <span className="text-slate-300">/wifi/band2g/config</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">/wifi/band5g/config</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">/wifi/smartmode</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">/wifi/capabilities</span>
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
            onClick={fetchWifiData}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-medium border border-rose-500/30 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
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
            <span>Live Wi-Fi Endpoints Payloads</span>
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

      {/* Smart Wi-Fi Steering Banner */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Smart Wi-Fi (Band Steering)</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              /wifi/smartmode
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Combines 2.4 GHz and 5 GHz networks under one SSID (<strong>{band2g.ssid}</strong>). Hub 5 intelligently steers devices to the fastest available band.
          </p>
        </div>

        <label className="relative inline-flex items-center cursor-pointer ml-4">
          <input
            type="checkbox"
            checked={smartMode}
            disabled={!smartWifiEditable}
            onChange={(e) => handleToggleSmartMode(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
        </label>
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* Dual Band Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 2.4 GHz Card */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-200">2.4 GHz Primary Network</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                802.11b/g/n/ax
              </span>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Network Name (SSID)</label>
                <input
                  type="text"
                  required
                  value={band2g.ssid}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBand2g(prev => ({ ...prev, ssid: val }));
                    if (smartMode) {
                      setBand5g(prev => ({ ...prev, ssid: val }));
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Security Mode</label>
                <select
                  value={band2g.securityType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBand2g(prev => ({ ...prev, securityType: val }));
                    if (smartMode) {
                      setBand5g(prev => ({ ...prev, securityType: val }));
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-rose-500"
                >
                  <option value="wpa2_psk_wpa3_sae">WPA2-PSK / WPA3-SAE Mixed (Recommended)</option>
                  <option value="wpa3_sae">WPA3-SAE Only</option>
                  <option value="wpa2_psk">WPA2-PSK (AES)</option>
                  <option value="disable">Disabled / Open</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Wi-Fi Password</label>
                <div className="relative">
                  <input
                    type={showPassword24 ? "text" : "password"}
                    required
                    value={band2g.passphrase}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBand2g(prev => ({ ...prev, passphrase: val }));
                      if (smartMode) {
                        setBand5g(prev => ({ ...prev, passphrase: val }));
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-rose-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword24(!showPassword24)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword24 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Channel Number</label>
                  <select
                    value={band2g.channelNumber}
                    onChange={(e) => setBand2g(prev => ({ ...prev, channelNumber: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    {(capabilities.band2g?.supportedChannels || [1, 6, 11]).map(ch => (
                      <option key={ch} value={ch}>Channel {ch}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Channel Width</label>
                  <select
                    value={band2g.channelWidth}
                    onChange={(e) => setBand2g(prev => ({ ...prev, channelWidth: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    <option value="20mhz">20 MHz</option>
                    <option value="40mhz">40 MHz</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 5 GHz Card */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-slate-200">5 GHz High-Speed Network</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Wi-Fi 6 (802.11ax) 160MHz
              </span>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Network Name (SSID)</label>
                <input
                  type="text"
                  required
                  disabled={smartMode}
                  value={smartMode ? band2g.ssid : band5g.ssid}
                  onChange={(e) => setBand5g(prev => ({ ...prev, ssid: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-rose-500 disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Security Mode</label>
                <select
                  disabled={smartMode}
                  value={smartMode ? band2g.securityType : band5g.securityType}
                  onChange={(e) => setBand5g(prev => ({ ...prev, securityType: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-rose-500 disabled:opacity-60"
                >
                  <option value="wpa2_psk_wpa3_sae">WPA2-PSK / WPA3-SAE Mixed (Recommended)</option>
                  <option value="wpa3_sae">WPA3-SAE Only</option>
                  <option value="wpa2_psk">WPA2-PSK (AES)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Wi-Fi Password</label>
                <div className="relative">
                  <input
                    type={showPassword5 ? "text" : "password"}
                    required
                    disabled={smartMode}
                    value={smartMode ? band2g.passphrase : band5g.passphrase}
                    onChange={(e) => setBand5g(prev => ({ ...prev, passphrase: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-rose-500 pr-10 disabled:opacity-60"
                  />
                  {!smartMode && (
                    <button
                      type="button"
                      onClick={() => setShowPassword5(!showPassword5)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword5 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Channel Number</label>
                  <select
                    value={band5g.channelNumber}
                    onChange={(e) => setBand5g(prev => ({ ...prev, channelNumber: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    {(capabilities.band5g?.supportedChannels || [36, 40, 44, 48, 108]).map(ch => (
                      <option key={ch} value={ch}>Channel {ch}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Channel Width</label>
                  <select
                    value={band5g.channelWidth}
                    onChange={(e) => setBand5g(prev => ({ ...prev, channelWidth: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    <option value="160mhz">160 MHz (Ultra-Fast AX)</option>
                    <option value="80mhz">80 MHz (High Compatibility)</option>
                    <option value="40mhz">40 MHz</option>
                    <option value="20mhz">20 MHz</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Guest Wi-Fi Card */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Guest Wi-Fi Network</h3>
                <span className="text-[10px] text-slate-400 font-mono">/wifi/band2g/guest/config &amp; /wifi/band5g/guest/config</span>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={guestConfig.enable}
                onChange={(e) => setGuestConfig(prev => ({ ...prev, enable: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {guestConfig.enable ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Guest SSID</label>
                <input
                  type="text"
                  required
                  value={guestConfig.ssid}
                  onChange={(e) => setGuestConfig(prev => ({ ...prev, ssid: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Guest Passphrase</label>
                <div className="relative">
                  <input
                    type={showGuestPassword ? "text" : "password"}
                    required
                    value={guestConfig.passphrase}
                    onChange={(e) => setGuestConfig(prev => ({ ...prev, passphrase: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-purple-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGuestPassword(!showGuestPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showGuestPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Guest network is disabled. When enabled, visitors can connect to the internet without gaining access to your home network devices.
            </p>
          )}
        </div>

        {/* Save bar */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
          <span className="text-slate-500 font-mono text-[11px]">
            PATCH /rest/v1/wifi/band2g/config &amp; /band5g/config
          </span>

          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-900/30 transition-colors disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'Applying to Hub 5...' : 'Apply Wi-Fi Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
