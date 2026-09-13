import React, { useState, useEffect } from 'react';
import {
  Settings,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Save,
  Check,
  AlertCircle,
  ShieldCheck,
  Trash2,
  Terminal,
  Send,
  Sparkles,
  Server,
  Network,
  Lightbulb,
  Sliders,
  ToggleLeft
} from 'lucide-react';
import { routerApi } from '../../services/routerApi.js';

export default function SettingsPage({
  config,
  onSaveConfig,
  onLogin,
  onClearPassword,
  savedPassword,
  onSendRequest
}) {
  const [baseUrl, setBaseUrl] = useState(config.routerBaseUrl || 'https://192.168.0.1');
  const [apiBasePath, setApiBasePath] = useState(config.apiBasePath || '/rest/v1/');
  const [authHeader, setAuthHeader] = useState(config.authHeaderName || 'X-Token');
  const [ignoreCerts, setIgnoreCerts] = useState(config.ignoreCertErrors !== false);
  const [mockMode, setMockMode] = useState(Boolean(config.mockMode));
  const [rememberPwd, setRememberPwd] = useState(config.rememberPassword !== false);

  const [password, setPassword] = useState(savedPassword || '');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginStatus, setLoginStatus] = useState(null);
  const [savedConfigSuccess, setSavedConfigSuccess] = useState(false);

  // API Explorer State
  const [explorerMethod, setExplorerMethod] = useState('GET');
  const [explorerEndpoint, setExplorerEndpoint] = useState('system/status');
  const [explorerBody, setExplorerBody] = useState('');
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [explorerResult, setExplorerResult] = useState(null);

  // Hardware Controls (LED & Modem Mode)
  const [ledBrightness, setLedBrightness] = useState('50');
  const [ledAutoMode, setLedAutoMode] = useState('true');
  const [modemModeEnabled, setModemModeEnabled] = useState(false);
  const [hwStatusMessage, setHwStatusMessage] = useState(null);

  useEffect(() => {
    if (savedPassword) {
      setPassword(savedPassword);
    }

    async function loadHardwareSettings() {
      try {
        if (!config.mockMode) {
          const [ledRes, mmRes] = await Promise.all([
            routerApi.getLedLight(),
            routerApi.getModemMode()
          ]);
          if (ledRes.data?.value) {
            setLedBrightness(ledRes.data.value.brightness || '50');
            setLedAutoMode(ledRes.data.value.automode || 'true');
          }
          if (mmRes.data?.modemmode) {
            setModemModeEnabled(Boolean(mmRes.data.modemmode.enable));
          }
        }
      } catch (e) {
        // non-fatal
      }
    }
    loadHardwareSettings();
  }, [savedPassword, config.mockMode]);

  const handleUpdateLed = async (brightness, automode) => {
    setLedBrightness(brightness);
    setLedAutoMode(automode);
    try {
      if (!config.mockMode) {
        await routerApi.setLedLight({ brightness, automode });
      }
      setHwStatusMessage('LED settings updated');
      setTimeout(() => setHwStatusMessage(null), 3000);
    } catch (err) {
      setHwStatusMessage('Failed to update LED: ' + err.message);
    }
  };

  const handleToggleModemMode = async () => {
    const next = !modemModeEnabled;
    const warn = next
      ? "Warning: Enabling Modem Mode (Bridge Mode) disables router NAT, DHCP, and Wi-Fi. The router will only serve as a cable modem at 192.168.100.1. Continue?"
      : "Disable Modem Mode and return to full Router Mode?";
    if (!confirm(warn)) return;

    setModemModeEnabled(next);
    try {
      if (!config.mockMode) {
        await routerApi.setModemMode(next);
      }
      setHwStatusMessage(`Modem Mode ${next ? 'enabled' : 'disabled'}`);
      setTimeout(() => setHwStatusMessage(null), 4000);
    } catch (err) {
      setModemModeEnabled(!next);
      setHwStatusMessage('Failed to change modem mode: ' + err.message);
    }
  };

  const handleSaveConnectionSettings = async (e) => {
    e.preventDefault();
    setSavedConfigSuccess(false);
    await onSaveConfig({
      routerBaseUrl: baseUrl,
      apiBasePath: apiBasePath,
      authHeaderName: authHeader,
      ignoreCertErrors: ignoreCerts,
      mockMode: mockMode,
      rememberPassword: rememberPwd
    });
    setSavedConfigSuccess(true);
    setTimeout(() => setSavedConfigSuccess(false), 3000);
  };

  const handleTestLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginStatus(null);
    try {
      // First ensure connection settings are saved
      await onSaveConfig({
        routerBaseUrl: baseUrl,
        apiBasePath: apiBasePath,
        authHeaderName: authHeader,
        ignoreCertErrors: ignoreCerts,
        mockMode: mockMode,
        rememberPassword: rememberPwd
      });

      const res = await onLogin(password);
      if (res.success) {
        setLoginStatus({
          success: true,
          message: 'Authenticated successfully with Virgin Media Hub 5!',
          token: res.token,
          data: res.raw
        });
      } else {
        const isSessionConflict =
          res.status === 503 ||
          res.raw?.errorCode === 65545 ||
          (res.error && (res.error.toLowerCase().includes('logged in') || res.error.toLowerCase().includes('someone else')));

        setLoginStatus({
          success: false,
          isConflict: isSessionConflict,
          message: isSessionConflict
            ? 'Someone else (or another active session) is currently logged into the Hub 5. Only one session is allowed at a time.'
            : (res.error || 'Authentication failed. Check router IP and password.')
        });
      }
    } catch (err) {
      setLoginStatus({ success: false, message: err.message });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleClearActiveTokens = async () => {
    await routerApi.clearTokens();
    setLoginStatus({
      success: true,
      message: 'Active session tokens and cookies cleared from local storage. Please retry login.'
    });
  };

  const handleClearCredentials = async () => {
    await onClearPassword();
    setPassword('');
    setLoginStatus(null);
  };

  const handleRunExplorer = async () => {
    setExplorerLoading(true);
    setExplorerResult(null);
    let parsedBody = null;
    if (explorerBody.trim()) {
      try {
        parsedBody = JSON.parse(explorerBody);
      } catch (e) {
        setExplorerResult({ success: false, error: 'Invalid JSON body: ' + e.message });
        setExplorerLoading(false);
        return;
      }
    }

    try {
      const res = await onSendRequest({
        endpoint: explorerEndpoint,
        method: explorerMethod,
        data: parsedBody
      });
      setExplorerResult(res);
    } catch (err) {
      setExplorerResult({ success: false, error: err.message });
    } finally {
      setExplorerLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Credentials & Authentication Panel */}
      <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-5">
        <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-rose-400" />
              <span>Router Authentication & Password Storage</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Virgin Media Hub 5 endpoint: <code className="text-rose-300 font-mono">POST /rest/v1/user/login</code> with payload <code className="text-slate-300 font-mono">&#123;"password": ...&#125;</code>
            </p>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            Encrypted (OS Keychain / AES-256)
          </span>
        </div>

        <form onSubmit={handleTestLogin} className="space-y-4">
          <div className="max-w-xl">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Hub 5 Settings / Admin Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="Enter router admin password (found on Hub 5 base sticker)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono pr-10 focus:outline-none focus:border-rose-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Usually printed as "Settings password" on the pull-out card or bottom sticker of the Hub 5.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rememberPwd"
              checked={rememberPwd}
              onChange={(e) => setRememberPwd(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-rose-500 focus:ring-rose-500"
            />
            <label htmlFor="rememberPwd" className="text-xs text-slate-300 cursor-pointer">
              Remember password securely on this computer (no need to enter after first login)
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isLoggingIn || !password}
              className="px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-50 transition-colors shadow-lg shadow-rose-900/30"
            >
              {isLoggingIn ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
              <span>{isLoggingIn ? 'Authenticating...' : 'Login & Save Password'}</span>
            </button>

            {config.hasSavedPassword && (
              <button
                type="button"
                onClick={handleClearCredentials}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-rose-950/40 hover:text-rose-300 text-slate-400 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Forget Stored Password</span>
              </button>
            )}
          </div>
        </form>

        {loginStatus && (
          <div className={`p-4 rounded-xl border text-xs ${loginStatus.success
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
            <div className="flex items-center gap-2 font-medium mb-1">
              {loginStatus.success ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{loginStatus.message}</span>
            </div>
            {loginStatus.token && (
              <div className="mt-2 pt-2 border-t border-emerald-500/20 font-mono text-[11px] text-emerald-400/90 break-all">
                Token: {loginStatus.token}
              </div>
            )}
            {loginStatus.isConflict && (
              <div className="mt-3 pt-3 border-t border-rose-500/20 space-y-2">
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  The Virgin Media Hub 5 allows only <strong>1 active session token</strong> at any time. When logging in outside this app, ensure you send a matching <code className="text-rose-300 bg-rose-950/60 px-1 py-0.5 rounded">User-Agent: curl/8.14.1</code> header, close any open router web browser tabs (<code className="text-slate-300">192.168.0.1</code>), or wait 10 minutes for session inactivity timeout.
                </p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-400 text-[11px]">
                    Clear locally cached session tokens and cookies:
                  </span>
                  <button
                    type="button"
                    onClick={handleClearActiveTokens}
                    className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-medium text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Active Tokens</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Network & Base URL Configuration */}
      <form onSubmit={handleSaveConnectionSettings} className="p-6 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-5">
        <div className="border-b border-slate-800 pb-3">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Network className="w-4 h-4 text-cyan-400" />
            <span>Connection & Endpoint Settings</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure the router host address, API version, and SSL certificate bypass options.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Router Base URL</label>
            <input
              type="text"
              required
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://192.168.0.1"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Default: https://192.168.0.1</span>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">API Base Path</label>
            <input
              type="text"
              required
              value={apiBasePath}
              onChange={(e) => setApiBasePath(e.target.value)}
              placeholder="/rest/v1/"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Default: /rest/v1/</span>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Auth Header Name</label>
            <input
              type="text"
              required
              value={authHeader}
              onChange={(e) => setAuthHeader(e.target.value)}
              placeholder="X-Token"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">e.g. X-Token or Authorization</span>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ignoreCerts"
              checked={ignoreCerts}
              onChange={(e) => setIgnoreCerts(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-cyan-500"
            />
            <label htmlFor="ignoreCerts" className="text-xs text-slate-300 cursor-pointer">
              Allow self-signed SSL certificates (Recommended for 192.168.0.1 HTTPS connections)
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mockMode"
              checked={mockMode}
              onChange={(e) => setMockMode(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500"
            />
            <label htmlFor="mockMode" className="text-xs text-slate-300 cursor-pointer flex items-center gap-1.5">
              <span>Enable Mock Data Mode (allows inspecting all app pages without router hardware)</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {savedConfigSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Connection settings saved
            </span>
          )}
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-cyan-900/30"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>

      {/* Hardware & System Controls */}
      <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-5">
        <div className="border-b border-slate-800 pb-3">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <span>Hardware & System Controls</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure the physical Virgin Media Hub 5 front LED light ring and bridge operation mode.
          </p>
        </div>

        {hwStatusMessage && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{hwStatusMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* LED Brightness Card */}
          <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800/60 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-slate-200">Front LED Ring Brightness</h4>
                <p className="text-[11px] text-slate-400">Control illumination level of the front LED light.</p>
              </div>
              <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {ledBrightness}%
              </span>
            </div>

            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={ledBrightness}
                onChange={(e) => handleUpdateLed(e.target.value, ledAutoMode)}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0% (Off)</span>
                <span>50%</span>
                <span>100% (Max)</span>
              </div>
            </div>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer pt-2 border-t border-slate-800/60">
              <span>Automatic night dimming mode</span>
              <input
                type="checkbox"
                checked={ledAutoMode === 'true'}
                onChange={(e) => handleUpdateLed(ledBrightness, e.target.checked ? 'true' : 'false')}
                className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500"
              />
            </label>
          </div>

          {/* Modem Mode Card */}
          <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800/60 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Modem Mode (Bridge Mode)</h4>
                  <p className="text-[11px] text-slate-400">Use your own third-party router or mesh network.</p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleModemMode}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${modemModeEnabled ? 'bg-amber-600' : 'bg-slate-700'
                    }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${modemModeEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>

              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                {modemModeEnabled
                  ? "Modem Mode is ACTIVE. Routing, Wi-Fi, and DHCP are disabled on the Hub 5. Management GUI is located at 192.168.100.1."
                  : "Router Mode is ACTIVE. Hub 5 handles Wi-Fi, DHCP routing, and NAT firewall."}
              </p>
            </div>

            <div className="text-[11px] text-amber-400/90 bg-amber-500/10 p-2.5 rounded border border-amber-500/20">
              Note: Changing operation mode reboots the Hub 5 network stack.
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Hub 5 REST API Explorer */}
      <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-purple-400" />
            <span>Interactive REST API Explorer</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Test any Hub 5 endpoint with the active authentication token to discover and verify endpoints directly.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={explorerMethod}
            onChange={(e) => setExplorerMethod(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200 focus:outline-none focus:border-purple-500"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>

          <div className="flex-1 flex items-center rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs font-mono">
            <span className="text-slate-500 shrink-0">{baseUrl.replace(/\/+$/, '')}{apiBasePath}</span>
            <input
              type="text"
              value={explorerEndpoint}
              onChange={(e) => setExplorerEndpoint(e.target.value)}
              placeholder="user/login or network/dhcp"
              className="flex-1 bg-transparent text-purple-300 focus:outline-none ml-1"
            />
          </div>

          <button
            type="button"
            onClick={handleRunExplorer}
            disabled={explorerLoading}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{explorerLoading ? 'Sending...' : 'Send Request'}</span>
          </button>
        </div>

        {explorerMethod !== 'GET' && (
          <div>
            <label className="block text-slate-400 text-[11px] mb-1 font-medium">JSON Request Body</label>
            <textarea
              rows={3}
              value={explorerBody}
              onChange={(e) => setExplorerBody(e.target.value)}
              placeholder='{ "key": "value" }'
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-500"
            />
          </div>
        )}

        {explorerResult && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Response</span>
              <span className={explorerResult.success ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                {explorerResult.status ? `Status: ${explorerResult.status}` : explorerResult.error || 'Failed'}
              </span>
            </div>
            <pre className="text-slate-200 max-h-60 overflow-y-auto p-3 bg-slate-900/90 rounded border border-slate-800 text-[11px] select-text">
              {JSON.stringify(explorerResult.data || explorerResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

