import type { IpcRouter } from '@backend/ipc/IpcRouter';
import { IPC_CHANNELS } from '@backend/ipc/channels';
import type { AIOrchestrator } from '@backend/ai/AIOrchestrator';

/**
 * Renderer-facing AI status handlers (M5.1). Only ever returns
 * `ProviderHealthSnapshot`/usage summaries — provider ids, state, and
 * timestamps. Never anything from `AppEnv`'s secret fields, and never
 * a raw provider/HTTP error object.
 */
export function registerAiHandlers(router: IpcRouter, orchestrator: AIOrchestrator): void {
  router.handle(IPC_CHANNELS.AI_GET_HEALTH, () => orchestrator.getHealthSummary());
  router.handle(IPC_CHANNELS.AI_GET_USAGE, () => orchestrator.getUsageSummary());
}
