const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('refosTmDesktop', Object.freeze({
  request: (route, body) => ipcRenderer.invoke('tm:request', route, body),
  setSyncActive: active => ipcRenderer.invoke('tm:active', active),
  openWebsite: website => ipcRenderer.invoke('tm:open', website),
  networkHelp: (action, website) => ipcRenderer.invoke('tm:network-help', action, website),
  connectionError: () => ipcRenderer.invoke('tm:connection-error'),
  savedWebsite: () => ipcRenderer.invoke('tm:website'),
}));
