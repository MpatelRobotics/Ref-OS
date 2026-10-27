const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('venueHost',{action:(action,value)=>ipcRenderer.invoke('venue:action',action,value)});
