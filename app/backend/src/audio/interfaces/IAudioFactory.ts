import type { IAudioSession, IAudioSessionMetadata } from '@backend/audio/interfaces/IAudioSession';
import type { IAudioDevice } from '@backend/audio/interfaces/IAudioDevice';
import type { AudioDeviceType } from '@backend/audio/types/AudioDeviceType';
import type { AudioConnectionType } from '@backend/audio/types/AudioConnectionType';
import type { IAudioChunk, IAudioChunkMetadata } from '@backend/audio/interfaces/IAudioChunk';

export interface CreateSessionInput {
  inputDeviceId?: string | null;
  outputDeviceId?: string | null;
  language?: string;
  metadata?: IAudioSessionMetadata;
}

export interface CreateDeviceInput {
  id: string;
  name: string;
  type: AudioDeviceType;
  connection: AudioConnectionType;
  isDefault?: boolean;
}

/**
 * Centralizes construction of audio domain objects so AudioManager
 * depends on this interface instead of concrete model classes
 * (Dependency Inversion) — swapping the concrete AudioSession/AudioDevice
 * implementation never requires changing AudioManager.
 */
export interface IAudioFactory {
  createSession(input: CreateSessionInput): IAudioSession;
  createDevice(input: CreateDeviceInput): IAudioDevice;
  createChunk(payload: Uint8Array, metadata: IAudioChunkMetadata): IAudioChunk;
}
