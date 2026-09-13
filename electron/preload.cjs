const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  savePassword: (password) => ipcRenderer.invoke('auth:save-password', password),
  getPassword: () => ipcRenderer.invoke('auth:get-password'),
  clearPassword: () => ipcRenderer.invoke('auth:clear-password'),
  clearTokens: () => ipcRenderer.invoke('auth:clear-tokens'),
  saveToken: (token) => ipcRenderer.invoke('auth:save-token', token),
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  request: (options) => ipcRenderer.invoke('router:request', options),
  platform: process.platform
});

