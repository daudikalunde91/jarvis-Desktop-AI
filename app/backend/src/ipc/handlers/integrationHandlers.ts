import type { IpcRouter } from '@backend/ipc/IpcRouter';
import { IPC_CHANNELS } from '@backend/ipc/channels';
import { isIntegrationCapability, type IntegrationCapability } from '@backend/integrations/capabilities';
import { toIntegrationError } from '@backend/integrations/errors';
import type { IntegrationManager } from '@backend/integrations/IntegrationManager';
import { INTEGRATION_IDS, type IntegrationId } from '@backend/integrations/types';

const isId = (v: unknown): v is IntegrationId => typeof v === 'string' && (INTEGRATION_IDS as readonly string[]).includes(v);

/**
 * Renderer-facing integration IPC. Everything is validated and returns
 * IntegrationStatus only (no tokens/secrets/account data). `connect` is the
 * user-initiated consent entry point — it is never reachable by the AI.
 */
export function registerIntegrationHandlers(router: IpcRouter, manager: IntegrationManager): void {
  router.handle(IPC_CHANNELS.INTEGRATIONS_GET_STATUS, () => manager.getAllStatuses());

  router.handle(IPC_CHANNELS.INTEGRATIONS_CONNECT, async (_e: unknown, request: unknown) => {
    const { id, capabilities } = (request ?? {}) as { id?: unknown; capabilities?: unknown };
    if (!isId(id) || !Array.isArray(capabilities) || !capabilities.every(isIntegrationCapability)) {
      return { ok: false, code: 'INVALID_REQUEST' };
    }
    try {
      return { ok: true, status: await manager.connect(id, capabilities as IntegrationCapability[]) };
    } catch (error) {
      return { ok: false, code: toIntegrationError(error).integrationCode };
    }
  });

  router.handle(IPC_CHANNELS.INTEGRATIONS_DISCONNECT, async (_e: unknown, request: unknown) => {
    const { id } = (request ?? {}) as { id?: unknown };
    if (!isId(id)) return { ok: false, code: 'INVALID_REQUEST' };
    try {
      return { ok: true, status: await manager.disconnect(id) };
    } catch (error) {
      return { ok: false, code: toIntegrationError(error).integrationCode };
    }
  });
}
