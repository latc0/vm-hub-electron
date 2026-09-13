// Bridge to Electron IPC API

const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI);

class RouterApiService {
  constructor() {
    this.isElectron = isElectron;
    this.token = null;
  }

  async getConfig() {
    if (this.isElectron) {
      const config = await window.electronAPI.getConfig();
      this.token = config.savedToken || null;
      return config;
    }
    return {
      routerBaseUrl: 'https://192.168.0.1',
      apiBasePath: '/rest/v1/',
      ignoreCertErrors: true,
      rememberPassword: true,
      authHeaderName: 'X-Token',
      hasSavedPassword: false,
      savedToken: null
    };
  }

  async saveConfig(newConfig) {
    if (this.isElectron) {
      return await window.electronAPI.saveConfig(newConfig);
    }
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
    if (!this.isElectron) {
      return { success: false, error: 'Electron environment required for live router communication' };
    }

    const res = await window.electronAPI.login({ password });
    if (res.success && res.token) {
      this.token = res.token;
    }
    return res;
  }

  // Generic router API call wrapper
  async request({ endpoint, method = 'GET', data = null, headers = {} }) {
    if (!this.isElectron) {
      return {
        success: false,
        status: 500,
        error: 'Electron environment required for router requests'
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
}

export const routerApi = new RouterApiService();

