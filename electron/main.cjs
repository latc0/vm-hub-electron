const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

let mainWindow = null;

// Config file in userData
const configPath = path.join(app.getPath('userData'), 'router-config.json');

// Default configuration
const defaultConfig = {
  routerBaseUrl: 'https://192.168.0.1',
  apiBasePath: '/rest/v1/',
  ignoreCertErrors: true,
  rememberPassword: true,
  authHeaderName: 'X-Token'
};

// Fallback AES key derived from machine specifics if safeStorage isn't supported
function getFallbackKey() {
  const seed = `${app.getPath('userData')}_router_hub5_seed`;
  return crypto.createHash('sha256').update(seed).digest();
}

function encryptText(plainText) {
  if (!plainText) return '';
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = safeStorage.encryptString(plainText);
      return `safe:${buffer.toString('base64')}`;
    }
  } catch (e) {
    console.warn('safeStorage failed, falling back to local cipher:', e.message);
  }

  // Fallback cipher
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getFallbackKey(), iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `aes:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptText(cipherText) {
  if (!cipherText) return '';
  try {
    if (cipherText.startsWith('safe:')) {
      const base64 = cipherText.slice(5);
      const buffer = Buffer.from(base64, 'base64');
      return safeStorage.decryptString(buffer);
    }
    if (cipherText.startsWith('aes:')) {
      const [, ivHex, authTagHex, encryptedHex] = cipherText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', getFallbackKey(), iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
  } catch (err) {
    console.error('Failed to decrypt password:', err.message);
    return '';
  }
  return '';
}

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw);
      return { ...defaultConfig, ...parsed };
    }
  } catch (err) {
    console.error('Error loading config:', err);
  }
  return { ...defaultConfig };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving config:', err);
    return false;
  }
}

// Global agent ignoring SSL cert errors for router
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Helper for making API requests to router
function makeRouterRequest({ url, method = 'GET', headers = {}, body = null, timeout = 10000 }) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const transport = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: method.toUpperCase(),
        headers: {
          'User-Agent': 'curl/8.14.1',
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          ...headers
        },
        timeout: timeout,
        agent: isHttps ? httpsAgent : undefined
      };

      const req = transport.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          let parsedBody = responseData;
          try {
            parsedBody = JSON.parse(responseData);
          } catch (e) {
            // Keep as string if not JSON
          }

          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            data: parsedBody
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timed out after ${timeout}ms`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (body) {
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
        req.setHeader('Content-Length', Buffer.byteLength(bodyStr));
        req.write(bodyStr);
      }

      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#020617',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    title: 'Virgin Media Hub 5 - Router Manager'
  });

  const isDev = process.env.WAIT_FOR_VITE === '1';
  const distIndex = path.join(__dirname, '../dist/index.html');

  if (isDev) {
    const checkServer = () => {
      http.get('http://localhost:5173', () => {
        mainWindow.loadURL('http://localhost:5173');
      }).on('error', () => {
        setTimeout(checkServer, 300);
      });
    };
    checkServer();
  } else if (fs.existsSync(distIndex)) {
    mainWindow.loadFile(distIndex);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  // Handle self-signed certificate error on electron webContents
  mainWindow.webContents.session.setCertificateVerifyProc((request, callback) => {
    const config = loadConfig();
    if (config.ignoreCertErrors) {
      callback(0); // 0 = trust
    } else {
      callback(-2); // default verification
    }
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Setup IPC Handlers
  ipcMain.handle('config:get', async () => {
    const config = loadConfig();
    return {
      routerBaseUrl: config.routerBaseUrl,
      apiBasePath: config.apiBasePath,
      ignoreCertErrors: config.ignoreCertErrors,
      rememberPassword: config.rememberPassword,
      authHeaderName: config.authHeaderName,
      hasSavedPassword: Boolean(config.encryptedPassword),
      savedToken: config.savedToken || null
    };
  });

  ipcMain.handle('config:save', async (_, newConfig) => {
    const current = loadConfig();
    const updated = {
      ...current,
      ...newConfig
    };
    return saveConfig(updated);
  });

  ipcMain.handle('auth:save-password', async (_, password) => {
    const current = loadConfig();
    current.encryptedPassword = encryptText(password);
    return saveConfig(current);
  });

  ipcMain.handle('auth:get-password', async () => {
    const current = loadConfig();
    if (!current.encryptedPassword) return '';
    return decryptText(current.encryptedPassword);
  });

  ipcMain.handle('auth:clear-password', async () => {
    const current = loadConfig();
    current.encryptedPassword = '';
    current.savedToken = null;
    return saveConfig(current);
  });

  ipcMain.handle('auth:clear-tokens', async () => {
    const current = loadConfig();
    current.savedToken = null;
    current.savedCookies = null;
    return saveConfig(current);
  });

  ipcMain.handle('auth:save-token', async (_, token) => {
    const current = loadConfig();
    current.savedToken = token;
    return saveConfig(current);
  });

  ipcMain.handle('router:request', async (_, { endpoint, method = 'GET', data = null, headers = {} }) => {
    const config = loadConfig();

    // Clean base URL and API base
    let base = config.routerBaseUrl.replace(/\/+$/, '');
    let apiBase = config.apiBasePath.replace(/^\/+/, '').replace(/\/+$/, '');
    let pathEndpoint = endpoint.replace(/^\/+/, '');

    const fullUrl = `${base}/${apiBase}/${pathEndpoint}`;

    const requestHeaders = { ...headers };
    if (config.savedToken) {
      requestHeaders[config.authHeaderName || 'X-Token'] = config.savedToken;
      requestHeaders['Authorization'] = `Bearer ${config.savedToken}`;
      requestHeaders['Token'] = config.savedToken;
    }
    if (config.savedCookies) {
      requestHeaders['Cookie'] = Array.isArray(config.savedCookies)
        ? config.savedCookies.map(c => c.split(';')[0]).join('; ')
        : config.savedCookies;
    }

    try {
      const response = await makeRouterRequest({
        url: fullUrl,
        method,
        headers: requestHeaders,
        body: data
      });
      const isHttpSuccess = response.status >= 200 && response.status < 300;
      return {
        success: isHttpSuccess,
        ...response,
        error: !isHttpSuccess ? (response.data?.message || response.statusText || `HTTP ${response.status}`) : undefined
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        url: fullUrl
      };
    }
  });

  // Login execution specifically for Virgin Media Hub 5
  ipcMain.handle('auth:login', async (_, { password }) => {
    const config = loadConfig();
    let base = config.routerBaseUrl.replace(/\/+$/, '');
    let apiBase = config.apiBasePath.replace(/^\/+/, '').replace(/\/+$/, '');

    // /rest/v1/user/login and session recovery via /user/3/tokens
    const loginUrl = `${base}/${apiBase}/user/login`;
    const tokensUrl = `${base}/${apiBase}/user/3/tokens`;

    try {
      let res = await makeRouterRequest({
        url: loginUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: { password }
      });

      // If router returns 503 or error 65545 ("someone else is logged in"), override/take over session via /user/3/tokens
      if (res.status === 503 || res.data?.errorCode === 65545) {
        res = await makeRouterRequest({
          url: tokensUrl,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: { password }
        });
      }

      if (res.status >= 200 && res.status < 300) {
        const token = res.data?.created?.token || res.data?.token;
        if (token) {
          config.savedToken = token;
          if (res.headers && res.headers['set-cookie']) {
            config.savedCookies = res.headers['set-cookie'];
          }
          if (config.rememberPassword) {
            config.encryptedPassword = encryptText(password);
          }
          saveConfig(config);
          return { success: true, token, raw: res.data };
        }
        return { success: false, error: 'Login response did not contain a token', raw: res.data };
      } else {
        return {
          success: false,
          status: res.status,
          error: res.data?.message || res.statusText || 'Authentication failed',
          raw: res.data
        };
      }
    } catch (err) {
      return { success: false, error: err.message, url: loginUrl };
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

