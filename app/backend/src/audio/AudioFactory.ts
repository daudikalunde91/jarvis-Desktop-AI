import type {
  CreateDeviceInput,
  CreateSessionInput,
  IAudioFactory,
} from '@backend/audio/interfaces/IAudioFactory';
import type { IAudioSession } from '@backend/audio/interfaces/IAudioSession';
import type { IAudioDevice } from '@backend/audio/interfaces/IAudioDevice';
import type { IAudioChunk, IAudioChunkMetadata } from '@backend/audio/interfaces/IAudioChunk';
import { AudioSession } from '@backend/audio/models/AudioSession';
import { AudioDevice } from '@backend/audio/models/AudioDevice';

/**
 * Centralizes construction of AudioSession, AudioDevice, and AudioChunk
 * instances. AudioManager depends on `IAudioFactory`, never on these
 * concrete classes directly — swapping the concrete model implementation
 * later never requires changing AudioManager (Dependency Inversion).
 */
export class AudioFactory implements IAudioFactory {
  createSession(input: CreateSessionInput): IAudioSession {
    return new AudioSession(input);
  }

  createDevice(input: CreateDeviceInput): IAudioDevice {
    return new AudioDevice(input);
  }

  createChunk(payload: Uint8Array, metadata: IAudioChunkMetadata): IAudioChunk {
    return { payload, metadata };
  }
}
