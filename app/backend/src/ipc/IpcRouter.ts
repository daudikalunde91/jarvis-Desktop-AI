import { ipcMain, type IpcMainInvokeEvent } from 'electron';

import type { ILogger } from '@backend/logging/ILogger';
import type { IpcChannel } from '@backend/ipc/channels';
import { IpcError } from '@backend/core/errors/AppError';

export type IpcHandler<TResult = unknown> = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<TResult> | TResult;

/**
 * Thin routing layer over Electron's ipcMain.
 * Centralizes handler registration and wraps every handler so IPC-level
 * errors are caught, logged, and returned as a predictable shape instead
 * of crashing the main process or leaking raw stack traces.
 *
 * Scope boundary: this class is a TRANSPORT ONLY. It must never contain
 * business logic, AI logic, or agent logic — handlers registered through
 * `handle()` own that behavior, and today's handlers (ipc/handlers/*) are
 * themselves foundation-only. When the future Communication Bus
 * (app/communication) is implemented, it will sit above this router as
 * just another handler group registered via ipc/registerIpc.ts — it will
 * not need to change how IpcRouter itself works.
 */
export class IpcRouter {
  private readonly registered = new Set<string>();

  constructor(private readonly logger: ILogger) {}

  handle<TResult>(channel: IpcChannel, handler: IpcHandler<TResult>): void {
    if (this.registered.has(channel)) {
      throw new IpcError(`IPC channel already registered: ${channel}`);
    }

    ipcMain.handle(channel, async (event, ...args) => {
      try {
        return await handler(event, ...args);
      } catch (error) {
        this.logger.error(`IPC handler failed for channel "${channel}"`, {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });

    this.registered.add(channel);
    this.logger.debug(`Registered IPC channel: ${channel}`);
  }

  dispose(): void {
    for (const channel of this.registered) {
      ipcMain.removeHandler(channel);
    }
    this.registered.clear();
  }
}
