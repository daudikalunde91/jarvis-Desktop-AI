import type {
  CreateVoiceSessionInput,
  IVoiceRuntimeFactory,
} from '@backend/voice-runtime/interfaces/IVoiceRuntimeFactory';
import type { IVoiceSession } from '@backend/voice-runtime/interfaces/IVoiceSession';
import { VoiceSession } from '@backend/voice-runtime/models/VoiceSession';

/**
 * Centralizes construction of VoiceSession instances. VoiceRuntimeManager
 * depends on `IVoiceRuntimeFactory`, never on the concrete `VoiceSession`
 * class, mirroring `AudioFactory` from Milestone 3.
 */
export class VoiceRuntimeFactory implements IVoiceRuntimeFactory {
  createSession(input: CreateVoiceSessionInput): IVoiceSession {
    return new VoiceSession(input);
  }
}
