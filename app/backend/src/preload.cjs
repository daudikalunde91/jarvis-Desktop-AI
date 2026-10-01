const { contextBridge, ipcRenderer } = require('electron');

const IPC_CHANNELS = Object.freeze({
  SYSTEM_GET_APP_INFO: 'system:get-app-info',
  SYSTEM_PING: 'system:ping',
  CONFIG_GET_ALL: 'config:get-all',
  BRAIN_HANDLE: 'brain:handle',
  SYSTEM_GET_HEALTH: 'system:get-health',
  AI_GET_HEALTH: 'ai:get-health',
  AI_GET_USAGE: 'ai:get-usage',
  INTEGRATIONS_GET_STATUS: 'integrations:get-status',
  INTEGRATIONS_CONNECT: 'integrations:connect',
  INTEGRATIONS_DISCONNECT: 'integrations:disconnect',
});

try {
  console.log('[JARVIS PRELOAD] initialized');
  const bridge = {
    ping: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_PING),
    getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_APP_INFO),
    getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_ALL),
    handleBrain: (request) => ipcRenderer.invoke(IPC_CHANNELS.BRAIN_HANDLE, request),
    getHealth: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_HEALTH),
    getAIHealth: () => ipcRenderer.invoke(IPC_CHANNELS.AI_GET_HEALTH),
    getAIUsage: () => ipcRenderer.invoke(IPC_CHANNELS.AI_GET_USAGE),
    // Stage 7: fixed, validated channels only. No tokens/secrets ever cross this bridge.
    getIntegrationStatus: () => ipcRenderer.invoke(IPC_CHANNELS.INTEGRATIONS_GET_STATUS),
    connectIntegration: (request) => ipcRenderer.invoke(IPC_CHANNELS.INTEGRATIONS_CONNECT, request),
    disconnectIntegration: (request) => ipcRenderer.invoke(IPC_CHANNELS.INTEGRATIONS_DISCONNECT, request),
  };

  contextBridge.exposeInMainWorld('jarvis', bridge);
  console.log('[JARVIS PRELOAD] window.jarvis exposed');
} catch (error) {
  console.error('[JARVIS PRELOAD] FAILED:', error);
}
