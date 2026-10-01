import type { IpcRouter } from '@backend/ipc/IpcRouter';
import { IPC_CHANNELS } from '@backend/ipc/channels';
import type { BrainManager } from '@backend/brain/BrainManager';

export interface BrainIpcRequest {
  utterance: string;
  sessionId?: string;
}

export function registerBrainHandlers(router: IpcRouter, brainManager: BrainManager): void {
  router.handle(IPC_CHANNELS.BRAIN_HANDLE, (_event, raw) => {
    const request = raw as BrainIpcRequest;
    if (!request || typeof request.utterance !== 'string' || !request.utterance.trim()) {
      throw new TypeError('Brain request requires a non-empty utterance.');
    }
    return brainManager.handle({
      utterance: request.utterance,
      sessionId:
        typeof request.sessionId === 'string' && request.sessionId.trim()
          ? request.sessionId.trim()
          : 'desktop',
      role: 'user',
    });
  });
}
