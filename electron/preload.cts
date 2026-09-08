import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("ajo", {
  call: (action: string, payload?: unknown) =>
    ipcRenderer.invoke("ajo", action, payload),
});
