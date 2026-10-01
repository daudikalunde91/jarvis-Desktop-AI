import type { IAudioSession, IAudioSessionMetadata } from '@backend/audio/interfaces/IAudioSession';
import type { AudioSessionStatus } from '@backend/audio/types/AudioSessionStatus';
import { generateId } from '@backend/shared/utilities/generateId';

export interface AudioSessionInput {
  inputDeviceId?: string | null;
  outputDeviceId?: string | null;
  language?: string;
  metadata?: IAudioSessionMetadata;
}

/**
 * Concrete AudioSession model. Holds only identifiers, timing, and
 * status — never audio payloads (see `docs/AUDIO_SESSION_GUIDE.md` for
 * the privacy rationale).
 */
export class AudioSession implements IAudioSession {
  public readonly id: string;
  public readonly inputDeviceId: string | null;
  public readonly outputDeviceId: string | null;
  public readonly language: string;
  public readonly startTime: number;
  public endTime: number | null = null;
  public latencyMs: number | null = null;
  public status: AudioSessionStatus = 'starting';
  public metadata: IAudioSessionMetadata;

  constructor(input: AudioSessionInput = {}) {
    this.id = generateId();
    this.inputDeviceId = input.inputDeviceId ?? null;
    this.outputDeviceId = input.outputDeviceId ?? null;
    this.language = input.language ?? 'en-US';
    this.startTime = Date.now();
    this.metadata = input.metadata ?? {};
  }

  activate(): void {
    this.status = 'active';
  }

  end(): void {
    this.status = 'ended';
    this.endTime = Date.now();
    this.latencyMs = this.endTime - this.startTime;
  }

  fail(reason: string): void {
    this.status = 'failed';
    this.endTime = Date.now();
    this.metadata = { ...this.metadata, failureReason: reason };
  }
}
