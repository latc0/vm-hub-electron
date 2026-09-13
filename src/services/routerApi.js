// Bridge to Electron IPC API with dev/browser mock fallback

const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI);

// Default mock state for testing UI without physical router connection
const mockData = {
  system: {
    model: 'Virgin Media Hub 5',
    hardwareVersion: '1.0',
    softwareVersion: 'LG-RDK-B-HUB5-v5.04.18',
    uptime: '14 days, 6 hours, 22 mins',
    wanIp: '82.14.99.120',
    gateway: '82.14.96.1',
    connectedDevicesCount: 18,
    cpuUsage: 14,
    ramUsage: 42
  },
  wifi: {
    enabled24: true,
    ssid24: 'VM-WiFi-5G-Home',
    security24: 'WPA2/WPA3-Personal',
    channel24: 6,
    bandwidth24: '20/40 MHz',
    enabled5: true,
    ssid5: 'VM-WiFi-5G-Home-5G',
    security5: 'WPA3-Personal',
    channel5: 36,
    bandwidth5: '80/160 MHz',
    guestEnabled: false,
    guestSsid: 'VM-Guest-Network'
  },
  dhcp: {
    routerIp: '192.168.0.1',
    subnetMask: '255.255.255.0',
    dhcpEnabled: true,
    startIp: '192.168.0.10',
    endIp: '192.168.0.254',
    leaseTimeHours: 24,
    leases: [
      { hostname: "Sam-MacBook-Pro", ip: "192.168.0.15", mac: "e4:e0:a4:23:41:9a", expires: "18h 42m", connection: "5 GHz Wi-Fi" },
      { hostname: "Living-Room-AppleTV", ip: "192.168.0.22", mac: "ac:fd:ce:90:12:ef", expires: "21h 10m", connection: "Ethernet 1G" },
      { hostname: "iPhone-15-Pro", ip: "192.168.0.35", mac: "4a:22:91:bb:03:d8", expires: "12h 05m", connection: "5 GHz Wi-Fi" },
      { hostname: "Philips-Hue-Bridge", ip: "192.168.0.50", mac: "00:17:88:5c:ee:22", expires: "Static/Reserved", connection: "Ethernet 100M" },
      { hostname: "Smart-TV-LG", ip: "192.168.0.64", mac: "70:bb:e9:12:aa:55", expires: "14h 50m", connection: "2.4 GHz Wi-Fi" },
      { hostname: "Sonos-One-Kitchen", ip: "192.168.0.71", mac: "48:a6:b8:30:19:ac", expires: "19h 30m", connection: "2.4 GHz Wi-Fi" }
    ],
    reservations: [
      { hostname: "Philips-Hue-Bridge", ip: "192.168.0.50", mac: "00:17:88:5c:ee:22" },
      { hostname: "Home-NAS-Server", ip: "192.168.0.200", mac: "00:11:32:99:a1:bf" }
    ]
  },
  dns: {
    mode: 'auto', // 'auto' (ISP) or 'manual'
    primaryDns: '194.168.4.100',
    secondaryDns: '194.168.8.100',
    customPrimary: '1.1.1.1',
    customSecondary: '1.0.0.1',
    dnsRebindProtection: true,
    ddnsEnabled: false,
    ddnsProvider: 'no-ip',
    ddnsDomain: ''
  },
  portForwarding: [
    { id: 1, rule: { enable: true, externalStartPort: 23592, externalEndPort: 23592, protocol: "udp", localStartPort: 41641, localEndPort: 41641, localAddress: "192.168.0.132", readOnly: false } },
    { id: 2, rule: { enable: true, externalStartPort: 8080, externalEndPort: 8080, protocol: "tcp", localStartPort: 80, localEndPort: 80, localAddress: "192.168.0.200", readOnly: false } }
  ],
  upnp: { enable: true },
  dmz: { enable: false, internalIp: '192.168.0.100' },
  firewall: {
    ipv4: { enable: true, blockFragmentedIpPackets: false, portScanProtect: true, ipFloodDetect: true },
    ipv6: { enable: true, blockFragmentedIpPackets: false, portScanProtect: true, ipFloodDetect: true }
  },
  ledLight: { brightness: "50", automode: "true" },
  modemMode: { enable: false },
  serviceFlows: [
    { serviceFlow: { serviceFlowId: 140156, direction: "downstream", maxTrafficRate: 1230000450, maxTrafficBurst: 42600 } },
    { serviceFlow: { serviceFlowId: 140155, direction: "upstream", maxTrafficRate: 110000274, maxTrafficBurst: 16800 } }
  ],
  eventLog: [
    { priority: "notice", time: new Date().toISOString(), message: "GUI Login Status - Login Success from LAN interface" },
    { priority: "warning", time: new Date(Date.now() - 3600000).toISOString(), message: "DHCP RENEW WARNING - Field invalid in response" },
    { priority: "notice", time: new Date(Date.now() - 7200000).toISOString(), message: "REG-RSP-MP Mismatch Between Calculated and Configured MIC" }
  ]
};

class RouterApiService {
  constructor() {
    this.isElectron = isElectron;
    this.token = null;
    this.useMock = false;
  }

  async getConfig() {
    if (this.isElectron) {
      const config = await window.electronAPI.getConfig();
      this.useMock = Boolean(config.mockMode);
      this.token = config.savedToken || null;
      return config;
    }
    // Fallback for browser testing
    return {
      routerBaseUrl: 'https://192.168.0.1',
      apiBasePath: '/rest/v1/',
      ignoreCertErrors: true,
      rememberPassword: true,
      authHeaderName: 'X-Token',
      mockMode: true,
      hasSavedPassword: false,
      savedToken: null
    };
  }

  async saveConfig(newConfig) {
    if (this.isElectron) {
      if ('mockMode' in newConfig) {
        this.useMock = Boolean(newConfig.mockMode);
      }
      return await window.electronAPI.saveConfig(newConfig);
    }
    this.useMock = Boolean(newConfig.mockMode);
    return true;
  }

  async getSavedPassword() {
    if (this.isElectron) {
      return await window.electronAPI.getPassword();
    }
    return '';
  }

  async savePassword(password) {
    if (this.isElectron) {
      return await window.electronAPI.savePassword(password);
    }
    return true;
  }

  async clearPassword() {
    if (this.isElectron) {
      this.token = null;
      return await window.electronAPI.clearPassword();
    }
    return true;
  }

  async clearTokens() {
    this.token = null;
    if (this.isElectron) {
      return await window.electronAPI.clearTokens();
    }
    return true;
  }

  async login(password) {
    if (this.useMock || !this.isElectron) {
      // Simulate network delay
      await new Promise(r => setTimeout(r, 600));
      this.token = 'mock-token-f73c7f58bfd88465a3c25e307b2cda88';
      return {
        success: true,
        token: this.token,
        raw: {
          created: {
            token: this.token,
            userLevel: 'regular',
            userId: 3
          }
        }
      };
    }

    const res = await window.electronAPI.login({ password });
    if (res.success && res.token) {
      this.token = res.token;
    }
    return res;
  }

  // Generic router API call wrapper
  async request({ endpoint, method = 'GET', data = null, headers = {} }) {
    if (this.useMock || !this.isElectron) {
      await new Promise(r => setTimeout(r, 400));
      return {
        success: true,
        status: 200,
        mock: true,
        data: { message: `Simulated mock response for ${method} ${endpoint}`, endpoint }
      };
    }

    return await window.electronAPI.request({ endpoint, method, data, headers });
  }

  // Specific DHCP & Network APIs
  async getGatewayProvisioning() {
    return await this.request({ endpoint: 'system/gateway/provisioning', method: 'GET' });
  }

  async getDhcpConfig() {
    return await this.request({ endpoint: 'network/ipv4/dhcp', method: 'GET' });
  }

  async updateDhcpConfig(payload) {
    let res = await this.request({ endpoint: 'network/ipv4/dhcp', method: 'PUT', data: payload });
    if (!res.success && res.status === 405) {
      // Fallback to POST if router prefers POST
      res = await this.request({ endpoint: 'network/ipv4/dhcp', method: 'POST', data: payload });
    }
    return res;
  }

  async getConnectedHosts() {
    return await this.request({ endpoint: 'network/hosts?connectedOnly=true', method: 'GET' });
  }

  async getReservedIps() {
    return await this.request({ endpoint: 'network/reservedipaddresses', method: 'GET' });
  }

  async addReservedIp(reservation) {
    return await this.request({
      endpoint: 'network/reservedipaddresses',
      method: 'POST',
      data: reservation
    });
  }

  async deleteReservedIp(item) {
    const id = item.id || item.macAddress || item.mac;
    let res = await this.request({
      endpoint: `network/reservedipaddresses/${encodeURIComponent(id)}`,
      method: 'DELETE'
    });
    if (!res.success) {
      // Fallback to DELETE on base path with body
      res = await this.request({
        endpoint: 'network/reservedipaddresses',
        method: 'DELETE',
        data: item
      });
    }
    return res;
  }

  // DNS APIs
  async getDnsConfig() {
    return await this.request({ endpoint: 'network/dns', method: 'GET' });
  }

  async updateDnsConfig(payload) {
    return await this.request({ endpoint: 'network/dns', method: 'PUT', data: payload });
  }

  // Wi-Fi APIs for Virgin Media Hub 5
  async getWifiCapabilities() {
    return await this.request({ endpoint: 'wifi/capabilities', method: 'GET' });
  }

  async getWifiSmartMode() {
    return await this.request({ endpoint: 'wifi/smartmode', method: 'GET' });
  }

  async updateWifiSmartMode(enable) {
    return await this.request({
      endpoint: 'wifi/smartmode',
      method: 'PUT',
      data: { smartmode: { enable } }
    });
  }

  async getWifiBand2gConfig() {
    return await this.request({ endpoint: 'wifi/band2g/config', method: 'GET' });
  }

  async getWifiBand5gConfig() {
    return await this.request({ endpoint: 'wifi/band5g/config', method: 'GET' });
  }

  async updateWifiBandConfig(band, configPayload) {
    // Hub 5 uses PATCH /rest/v1/wifi/band2g/config and /wifi/band5g/config
    return await this.request({
      endpoint: `wifi/${band}/config`,
      method: 'PATCH',
      data: configPayload
    });
  }

  async getWifiGuestConfig() {
    return await this.request({ endpoint: 'wifi/band2g/guest/config', method: 'GET' });
  }

  async updateWifiGuestConfig(guestPayload) {
    // Hub 5 updates both band2g and band5g guest configs
    const res2g = await this.request({
      endpoint: 'wifi/band2g/guest/config',
      method: 'PATCH',
      data: guestPayload
    });
    const res5g = await this.request({
      endpoint: 'wifi/band5g/guest/config',
      method: 'PATCH',
      data: guestPayload
    });
    return res2g.success ? res2g : res5g;
  }

  // System Diagnostics & Maintenance APIs
  async startPingJob(host, numberOfPings = 4, dataBlockSize = 64) {
    return await this.request({
      endpoint: 'system/diagnostics/ping/jobs',
      method: 'POST',
      data: {
        pingJob: {
          parameters: {
            host,
            numberOfPings: Number(numberOfPings),
            dataBlockSize: Number(dataBlockSize)
          }
        }
      }
    });
  }

  async getPingJobState(jobId) {
    return await this.request({
      endpoint: `system/diagnostics/ping/job/${jobId}?stateOnly=true`,
      method: 'GET'
    });
  }

  async getPingJobResult(jobId) {
    return await this.request({
      endpoint: `system/diagnostics/ping/job/${jobId}`,
      method: 'GET'
    });
  }

  async deletePingJob(jobId) {
    return await this.request({
      endpoint: `system/diagnostics/ping/job/${jobId}`,
      method: 'DELETE'
    });
  }

  async startTracerouteJob(host, maxHopCount = 30, port = 33434) {
    return await this.request({
      endpoint: 'system/diagnostics/traceroute/jobs',
      method: 'POST',
      data: {
        traceRouteJob: {
          parameters: {
            host,
            maxHopCount: Number(maxHopCount),
            port: Number(port)
          }
        }
      }
    });
  }

  async getTracerouteJobState(jobId) {
    return await this.request({
      endpoint: `system/diagnostics/traceroute/job/${jobId}?stateOnly=true`,
      method: 'GET'
    });
  }

  async getTracerouteJobResult(jobId) {
    return await this.request({
      endpoint: `system/diagnostics/traceroute/job/${jobId}`,
      method: 'GET'
    });
  }

  async deleteTracerouteJob(jobId) {
    return await this.request({
      endpoint: `system/diagnostics/traceroute/job/${jobId}`,
      method: 'DELETE'
    });
  }

  async rebootRouter(reason = 'Reboot from UI') {
    return await this.request({
      endpoint: 'system/reboot',
      method: 'POST',
      data: {
        reboot: {
          enable: true,
          reason
        }
      }
    });
  }

  // System & DOCSIS Cable Modem APIs
  async getSystemInfo() {
    return await this.request({ endpoint: 'system/info_', method: 'GET' });
  }

  async getCableModemState() {
    return await this.request({ endpoint: 'cablemodem/state_', method: 'GET' });
  }

  async getDownstreamChannels() {
    return await this.request({ endpoint: 'cablemodem/downstream', method: 'GET' });
  }

  async getUpstreamChannels() {
    return await this.request({ endpoint: 'cablemodem/upstream', method: 'GET' });
  }

  // Port Forwarding, UPnP, DMZ, Firewall
  async getPortForwarding() {
    return await this.request({ endpoint: 'network/portforwarding', method: 'GET' });
  }

  async savePortForwardingRule(rule, id = null) {
    if (id) {
      return await this.request({
        endpoint: `network/portforwarding/rule/${id}`,
        method: 'PUT',
        data: { rule }
      });
    }
    return await this.request({
      endpoint: 'network/portforwarding/rule',
      method: 'POST',
      data: { rule }
    });
  }

  async deletePortForwardingRule(id) {
    return await this.request({
      endpoint: `network/portforwarding/rule/${id}`,
      method: 'DELETE'
    });
  }

  async getUpnp() {
    return await this.request({ endpoint: 'network/upnp', method: 'GET' });
  }

  async setUpnp(enable) {
    return await this.request({
      endpoint: 'network/upnp',
      method: 'PATCH',
      data: { upnp: { enable: Boolean(enable) } }
    });
  }

  async getDmz() {
    return await this.request({ endpoint: 'network/ipv4/dmz', method: 'GET' });
  }

  async setDmz({ enable, internalIp }) {
    return await this.request({
      endpoint: 'network/ipv4/dmz',
      method: 'PATCH',
      data: { dmz: { enable: Boolean(enable), internalIp } }
    });
  }

  async getFirewall() {
    const [ipv4, ipv6] = await Promise.all([
      this.request({ endpoint: 'network/ipv4/firewall', method: 'GET' }),
      this.request({ endpoint: 'network/ipv6/firewall', method: 'GET' })
    ]);
    return { ipv4, ipv6 };
  }

  async setIpv4Firewall(config) {
    return await this.request({
      endpoint: 'network/ipv4/firewall',
      method: 'PATCH',
      data: { firewall: config }
    });
  }

  async setIpv6Firewall(config) {
    return await this.request({
      endpoint: 'network/ipv6/firewall',
      method: 'PATCH',
      data: { firewall: config }
    });
  }

  // Service Flows & DOCSIS Event Log
  async getServiceFlows() {
    return await this.request({ endpoint: 'cablemodem/serviceflows', method: 'GET' });
  }

  async getEventLog() {
    return await this.request({ endpoint: 'cablemodem/eventlog', method: 'GET' });
  }

  // Hardware Controls (LED & Modem Mode)
  async getLedLight() {
    return await this.request({ endpoint: 'network/ledlight', method: 'GET' });
  }

  async setLedLight({ brightness, automode }) {
    return await this.request({
      endpoint: 'network/ledlight',
      method: 'PATCH',
      data: {
        value: {
          brightness: String(brightness),
          automode: String(automode)
        }
      }
    });
  }

  async getModemMode() {
    return await this.request({ endpoint: 'system/modemmode', method: 'GET' });
  }

  async setModemMode(enable) {
    return await this.request({
      endpoint: 'system/modemmode',
      method: 'POST',
      data: { modemmode: { enable: Boolean(enable) } }
    });
  }

  // Get mock store for UI rendering
  getMockData() {
    return mockData;
  }
}

export const routerApi = new RouterApiService();

