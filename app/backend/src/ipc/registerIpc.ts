import type { IpcRouter } from '@backend/ipc/IpcRouter';
import type { IConfigManager } from '@backend/config/IConfigManager';
import type { BrainManager } from '@backend/brain/BrainManager';
import type { AIOrchestrator } from '@backend/ai/AIOrchestrator';
import { registerSystemHandlers } from '@backend/ipc/handlers/systemHandlers';
import { registerBrainHandlers } from '@backend/ipc/handlers/brainHandlers';
import { registerAiHandlers } from '@backend/ipc/handlers/aiHandlers';
import { registerIntegrationHandlers } from '@backend/ipc/handlers/integrationHandlers';
import type { IntegrationManager } from '@backend/integrations/IntegrationManager';

/** Single composition point for renderer-facing IPC handler groups. */
export function registerIpc(
  router: IpcRouter,
  configManager: IConfigManager,
  brainManager: BrainManager,
  aiOrchestrator: AIOrchestrator,
  integrationManager?: IntegrationManager,
): void {
  registerSystemHandlers(router, configManager, brainManager);
  registerBrainHandlers(router, brainManager);
  registerAiHandlers(router, aiOrchestrator);
  if (integrationManager) registerIntegrationHandlers(router, integrationManager);
}
