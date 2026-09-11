'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', Object.freeze({
  health: () => ipcRenderer.invoke('engine:health'),
  updateState: () => ipcRenderer.invoke('engine:update-state'),
  openEngine: () => ipcRenderer.invoke('engine:open'),
  engineStatus: () => ipcRenderer.invoke('engine:status'),
  locateEngine: () => ipcRenderer.invoke('engine:locate'),
  restart: () => ipcRenderer.invoke('engine:restart'),
  stop: () => ipcRenderer.invoke('engine:stop'),
  doctor: () => ipcRenderer.invoke('engine:doctor'),
  checkForUpdates: () => ipcRenderer.invoke('engine:updates'),
  openWorkspace: () => ipcRenderer.invoke('engine:workspace'),
  // Product/Auth operations
  product: Object.freeze({
    authStatus: () => ipcRenderer.invoke('auth:status'),
    signIn: (credentials) => ipcRenderer.invoke('auth:sign-in', credentials),
    signOut: () => ipcRenderer.invoke('auth:sign-out'),
    workspaces: () => ipcRenderer.invoke('product:workspaces'),
    chooseWorkspace: (slug) => ipcRenderer.invoke('product:choose-workspace', slug),
    artifacts: () => ipcRenderer.invoke('product:artifacts'),
    createArtifact: (input) => ipcRenderer.invoke('product:create-artifact', input),
    bandLevels: () => ipcRenderer.invoke('product:band-levels'),
    bandFor: (artifactId) => ipcRenderer.invoke('product:band-for', artifactId),
    chooseBand: (artifactId, levelId) => ipcRenderer.invoke('product:choose-band', artifactId, levelId),
    createWorkspace: (slug) => ipcRenderer.invoke('product:create-workspace', slug),
  })
}));
