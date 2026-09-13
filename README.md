# Virgin Media Hub 5 - Router Manager (Desktop App)

A desktop application built with Electron, React, and Tailwind CSS for managing the **Virgin Media Hub 5** (Sagemcom FAST 3896LG running RDK-B firmware `LG-RDK_13.7.3-2509.5`) via its native `/rest/v1/` REST API.

---

## Features

### 1. Authentication & Session Management
- **Automatic Session Handling**: Authenticates using `/rest/v1/user/login` and handles takeover via `/rest/v1/user/3/tokens`.
- **Encrypted Password Storage**: Uses Electron's native `safeStorage` (backing onto Linux Secret Service/libsecret, macOS Keychain, or Windows DPAPI), with AES-256-GCM encrypted local store fallback.
- **Session Conflict Resolution**: Automatically mitigates Hub 5 single-session locks (`errorCode: 65545`) using consistent agent headers (`User-Agent: curl/8.14.1`).

### 2. Network & Host Configuration
- Configurable **Router Base URL** (defaults to `https://192.168.0.1`).
- Configurable **API Base Path** (defaults to `/rest/v1/`).
- **Self-Signed SSL Handling**: Automatically trusts router self-signed certificates without security rejections.

### 3. Application Modules
- **Overview / Dashboard**: Live DOCSIS 3.1 channel telemetry, uptime, public WAN IP, gateway, hardware/software versions, connected device counters, and memory/CPU utilization.
- **Wi-Fi 6 Configuration**: Dual-band controls for 2.4 GHz and 5 GHz (160 MHz channels), SSID, channel selection, WPA2/WPA3 security, band steering, and Guest Wi-Fi.
- **DHCP & Local Network**: Gateway IP, subnet mask, IP allocation range, active client leases table (with search, connection type, and static IP reservations), and reserved IP table.
- **DNS & Domains**: Switch between ISP DNS and custom DNS resolvers (with 1-click presets for Cloudflare, Google, Quad9, AdGuard), DNS rebind protection, and Dynamic DNS (DDNS).
- **Port Rules & Firewall**:
  - Live NAT port forwarding rules table with add/delete modals.
  - UPnP (Universal Plug and Play) toggle.
  - DMZ Host assignment and toggle.
  - IPv4 & IPv6 firewall controls (port scan protection, IP flood/DoS defense, fragmented packet blocking).
- **Modem Logs & DOCSIS**:
  - Provisioned bandwidth meters (downstream and upstream traffic rate caps).
  - Live DOCSIS cable modem event logs with priority filtering (`Notice`, `Warning`, `Critical`) and search.
- **Network Tools**:
  - Hub 5 native async ICMP Ping and Traceroute jobs with live result polling.
  - Virgin Media Hub 5 soft reboot trigger with confirmation modal.
- **Settings & Hardware Controls**:
  - Front LED ring brightness slider (0% to 100%) and night auto-dimming mode.
  - Modem Mode (Bridge Mode) toggle.
  - Credential vault and interactive REST API Explorer.

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation
```bash
npm install
```

### Development Mode (with Hot Module Reloading)
```bash
npm run dev
```

### Build & Run Desktop App
```bash
npm run build
npm start
```

---

## Project Structure

```
router-app/
├── electron/
│   ├── main.cjs        # Electron main process (safeStorage, HTTPS agent, IPC handlers)
│   └── preload.cjs     # Context bridge (window.electronAPI)
├── src/
│   ├── components/
│   │   ├── Sidebar.jsx
│   │   ├── Header.jsx
│   │   └── pages/
│   │       ├── DashboardPage.jsx
│   │       ├── WifiPage.jsx
│   │       ├── DhcpPage.jsx
│   │       ├── DnsPage.jsx
│   │       ├── PortForwardingPage.jsx
│   │       ├── ModemLogsPage.jsx
│   │       ├── ToolsPage.jsx
│   │       └── SettingsPage.jsx
│   ├── services/
│   │   └── routerApi.js # IPC bridge, REST API client, and mock state
│   ├── App.jsx          # Main application shell and routing
│   ├── index.css        # Tailwind styles
│   └── main.jsx         # React root
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js
```
