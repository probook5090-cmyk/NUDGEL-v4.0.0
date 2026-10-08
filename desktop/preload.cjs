const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lumaStudio", {
  getState: () => ipcRenderer.invoke("studio:get-state"),
  start: () => ipcRenderer.invoke("studio:start"),
  stop: () => ipcRenderer.invoke("studio:stop"),
  restart: () => ipcRenderer.invoke("studio:restart"),
  chooseProject: () => ipcRenderer.invoke("studio:choose-project"),
  copyUrl: () => ipcRenderer.invoke("studio:copy-url"),
  openPreview: () => ipcRenderer.invoke("studio:open-preview"),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("studio:state", listener);
    return () => ipcRenderer.removeListener("studio:state", listener);
  },
});
