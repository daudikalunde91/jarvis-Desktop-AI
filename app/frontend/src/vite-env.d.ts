/// <reference types="vite/client" />

export {};

/**
 * Typed surface of the API exposed by the Electron preload script via
 * contextBridge. Kept in sync manually with app/backend/src/preload.ts
 * for Milestone 1 — a generated/shared types package can replace this
 * once the backend and frontend build pipelines are unified.
 */
interface JarvisBridge {
  ping: () => Promise<{ pong: boolean; timestamp: number }>;
  getAppInfo: () => Promise<{ name: string; version: string; description: string }>;
  getConfig: () => Promise<Record<string, unknown>>;
  handleBrain: (request: { utterance: string; sessionId?: string }) => Promise<unknown>;
  getHealth: () => Promise<string>;
  getAIHealth: () => Promise<unknown>;
  getAIUsage: () => Promise<unknown>;
  getIntegrationStatus: () => Promise<unknown>;
  connectIntegration: (request: { id: string; capabilities: string[] }) => Promise<unknown>;
  disconnectIntegration: (request: { id: string }) => Promise<unknown>;
}

declare global {
  interface Window {
    jarvis: JarvisBridge;
  }
}
