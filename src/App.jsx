import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import DashboardPage from './components/pages/DashboardPage.jsx';
import WifiPage from './components/pages/WifiPage.jsx';
import DhcpPage from './components/pages/DhcpPage.jsx';
import DnsPage from './components/pages/DnsPage.jsx';
import ToolsPage from './components/pages/ToolsPage.jsx';
import SettingsPage from './components/pages/SettingsPage.jsx';
import PortForwardingPage from './components/pages/PortForwardingPage.jsx';
import ModemLogsPage from './components/pages/ModemLogsPage.jsx';
import { routerApi } from './services/routerApi.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [config, setConfig] = useState({
    routerBaseUrl: 'https://192.168.0.1',
    apiBasePath: '/rest/v1/',
    ignoreCertErrors: true,
    rememberPassword: true,
    authHeaderName: 'X-Token',
    hasSavedPassword: false
  });
  const [savedPassword, setSavedPassword] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [routerStatus, setRouterStatus] = useState({
    authenticated: false,
    token: null,
    routerBaseUrl: 'https://192.168.0.1'
  });

  // On mount, load config and stored credentials
  useEffect(() => {
    async function init() {
      try {
        const loadedConfig = await routerApi.getConfig();
        setConfig(loadedConfig);

        setRouterStatus(prev => ({
          ...prev,
          routerBaseUrl: loadedConfig.routerBaseUrl,
          authenticated: Boolean(loadedConfig.savedToken),
          token: loadedConfig.savedToken || null
        }));

        if (loadedConfig.hasSavedPassword) {
          const pwd = await routerApi.getSavedPassword();
          setSavedPassword(pwd);

          // If we have saved password and not authenticated, try login
          if (pwd && !loadedConfig.savedToken) {
            handleLogin(pwd);
          }
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    }
    init();
  }, []);

  const handleLogin = async (password) => {
    const res = await routerApi.login(password);
    if (res.success && res.token) {
      setRouterStatus(prev => ({
        ...prev,
        authenticated: true,
        token: res.token
      }));
      setSavedPassword(password);
      return res;
    }
    return res;
  };

  const handleLogout = async () => {
    await routerApi.clearPassword();
    setRouterStatus(prev => ({
      ...prev,
      authenticated: false,
      token: null
    }));
    setSavedPassword('');
  };

  const handleSaveConfig = async (newConfig) => {
    await routerApi.saveConfig(newConfig);
    setConfig(newConfig);
    setRouterStatus(prev => ({
      ...prev,
      routerBaseUrl: newConfig.routerBaseUrl
    }));
  };

  const handleClearPassword = async () => {
    await routerApi.clearPassword();
    setSavedPassword('');
    setRouterStatus(prev => ({
      ...prev,
      authenticated: false,
      token: null
    }));
  };

  const handleSendRequest = async (req) => {
    return await routerApi.request(req);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(r => setTimeout(r, 600));
    setIsRefreshing(false);
  };

  const handleSaveWifi = async (wifiPayload) => {
    return await routerApi.request({
      endpoint: 'wireless/config',
      method: 'PUT',
      data: wifiPayload
    });
  };

  const handleSaveDhcp = async (dhcpPayload) => {
    return await routerApi.request({
      endpoint: 'network/dhcp',
      method: 'PUT',
      data: dhcpPayload
    });
  };

  const handleSaveDns = async (dnsPayload) => {
    return await routerApi.request({
      endpoint: 'network/dns',
      method: 'PUT',
      data: dnsPayload
    });
  };

  const handleReboot = async () => {
    return await routerApi.request({
      endpoint: 'system/reboot',
      method: 'POST',
      data: { action: 'reboot' }
    });
  };

  // Titles mapping
  const titles = {
    dashboard: { title: 'Router Overview', subtitle: 'Virgin Media Hub 5 system metrics, status, and quick settings' },
    wifi: { title: 'Wi-Fi 6 Configuration', subtitle: 'Manage 2.4 GHz and 5 GHz wireless networks, guest network, and security' },
    dhcp: { title: 'DHCP & Local Network', subtitle: 'Manage IP address pool, lease times, and reserved client addresses' },
    dns: { title: 'DNS Resolution & Domains', subtitle: 'Choose ISP or custom DNS resolvers, DNS rebind security, and DDNS' },
    ports: { title: 'Port Forwarding & Firewall', subtitle: 'NAT port mappings, UPnP automatic ports, DMZ host, and packet filters' },
    logs: { title: 'Modem Logs & DOCSIS', subtitle: 'Live DOCSIS cable modem event logs and provisioned speed flows' },
    tools: { title: 'Network Diagnostics & Control', subtitle: 'Ping, traceroute, and Virgin Media Hub 5 power maintenance' },
    settings: { title: 'Settings & Hardware Controls', subtitle: 'Host configuration, front LED ring, modem mode, and credentials' }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        routerStatus={routerStatus}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          title={titles[activeTab]?.title}
          subtitle={titles[activeTab]?.subtitle}
          routerStatus={routerStatus}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onOpenSettings={() => setActiveTab('settings')}
        />

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto pb-12">
            {activeTab === 'dashboard' && (
              <DashboardPage
                routerStatus={routerStatus}
                onNavigate={setActiveTab}
                onReboot={handleReboot}
              />
            )}

            {activeTab === 'wifi' && (
              <WifiPage
                onSaveWifi={handleSaveWifi}
                onSendRequest={handleSendRequest}
              />
            )}

            {activeTab === 'dhcp' && (
              <DhcpPage
                onSaveDhcp={handleSaveDhcp}
                onSendRequest={handleSendRequest}
              />
            )}

            {activeTab === 'dns' && (
              <DnsPage
                onSaveDns={handleSaveDns}
                onSendRequest={handleSendRequest}
              />
            )}

            {activeTab === 'ports' && (
              <PortForwardingPage
                routerStatus={routerStatus}
              />
            )}

            {activeTab === 'logs' && (
              <ModemLogsPage
                routerStatus={routerStatus}
              />
            )}

            {activeTab === 'tools' && (
              <ToolsPage
                onSendRequest={handleSendRequest}
                onReboot={handleReboot}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsPage
                config={config}
                onSaveConfig={handleSaveConfig}
                onLogin={handleLogin}
                onClearPassword={handleClearPassword}
                savedPassword={savedPassword}
                onSendRequest={handleSendRequest}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

