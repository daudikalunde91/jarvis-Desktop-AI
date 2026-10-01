import { IPC_NAMESPACE } from '@backend/core/constants';

/**
 * Every IPC channel string used by the application is declared here.
 * Renderer and main process both import from this single source of
 * truth to avoid magic strings and channel name drift.
 */
export const IPC_CHANNELS = {
  SYSTEM_GET_APP_INFO: `${IPC_NAMESPACE.SYSTEM}:get-app-info`,
  SYSTEM_PING: `${IPC_NAMESPACE.SYSTEM}:ping`,
  CONFIG_GET_ALL: `${IPC_NAMESPACE.CONFIG}:get-all`,
  BRAIN_HANDLE: `${IPC_NAMESPACE.BRAIN}:handle`,
  SYSTEM_GET_HEALTH: `${IPC_NAMESPACE.SYSTEM}:get-health`,
  AI_GET_HEALTH: `${IPC_NAMESPACE.AI}:get-health`,
  AI_GET_USAGE: `${IPC_NAMESPACE.AI}:get-usage`,
  INTEGRATIONS_GET_STATUS: 'integrations:get-status',
  INTEGRATIONS_CONNECT: 'integrations:connect',
  INTEGRATIONS_DISCONNECT: 'integrations:disconnect',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
