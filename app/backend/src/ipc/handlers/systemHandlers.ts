import type { IpcRouter } from '@backend/ipc/IpcRouter';
import { IPC_CHANNELS } from '@backend/ipc/channels';
import type { IConfigManager } from '@backend/config/IConfigManager';
import { APP_METADATA } from '@backend/core/constants';
import type { BrainManager } from '@backend/brain/BrainManager';

/**
 * Foundation-level system handlers. Intentionally minimal — just enough
 * to prove the IPC bridge works end-to-end (ping, app info, config read).
 */
export function registerSystemHandlers(router: IpcRouter, configManager: IConfigManager, brainManager: BrainManager): void {
  router.handle(IPC_CHANNELS.SYSTEM_PING, () => ({ pong: true, timestamp: Date.now() }));

  router.handle(IPC_CHANNELS.SYSTEM_GET_APP_INFO, () => ({
    name: APP_METADATA.name,
    version: APP_METADATA.version,
    description: APP_METADATA.description,
  }));

  router.handle(IPC_CHANNELS.CONFIG_GET_ALL, () => configManager.getAll());

  router.handle(IPC_CHANNELS.SYSTEM_GET_HEALTH, () => brainManager.healthCheck());
}
