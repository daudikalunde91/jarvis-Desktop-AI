import { contextBridge, ipcRenderer } from 'electron';

/**
 * Electron sandboxed preload boundary.
 *
 * This file is intentionally self-contained. Sandboxed Electron preloads do
 * not have normal access to arbitrary local CommonJS modules, so importing a
 * local module here can stop the preload before contextBridge is exposed.
 */

// Development-only diagnostics. Guarded and wrapped in try/catch so this can
// never throw or run in a packaged production build. Electron's sandboxed
// preload still exposes a minimal `process` (env/platform/versions), so this
// check works even with sandbox: true.
const isDev = (() => {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
})();
const devLog = (message: string): void => {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log(`[IPC] ${message}`);
  }
};

devLog('preload loaded');

const IPC_CHANNELS = {
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
} as const;

const jarvisBridge = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_PING),
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_APP_INFO),
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_ALL),
  handleBrain: (request: { utterance: string; sessionId?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.BRAIN_HANDLE, request),
  getHealth: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_HEALTH),
  getAIHealth: () => ipcRenderer.invoke(IPC_CHANNELS.AI_GET_HEALTH),
  getAIUsage: () => ipcRenderer.invoke(IPC_CHANNELS.AI_GET_USAGE),
  getIntegrationStatus: () => ipcRenderer.invoke(IPC_CHANNELS.INTEGRATIONS_GET_STATUS),
  connectIntegration: (request: { id: string; capabilities: string[] }) =>
    ipcRenderer.invoke(IPC_CHANNELS.INTEGRATIONS_CONNECT, request),
  disconnectIntegration: (request: { id: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.INTEGRATIONS_DISCONNECT, request),
};

contextBridge.exposeInMainWorld('jarvis', jarvisBridge);

devLog('bridge exposed (window.jarvis)');

export type JarvisBridge = typeof jarvisBridge;
