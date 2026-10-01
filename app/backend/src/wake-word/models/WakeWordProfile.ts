import type { SecureWakeLevel } from '@backend/wake-word/types/SecureWakeLevel';
import { generateId } from '@backend/shared/utilities/generateId';
import { WakeWordProfileError } from '@backend/wake-word/errors/WakeWordError';

export interface WakeWordProfileInput {
  name?: string;
  wakeWordPhrase?: string;
  sensitivity?: number;
  confidenceThreshold?: number;
  cooldownMs?: number;
  secureWakeLevel?: SecureWakeLevel;
  enabled?: boolean;
}

/**
 * A configurable wake-word profile. The default phrase is "Jarvis";
 * the shape deliberately makes future custom wake words ("Friday",
 * "Nova", ...) a matter of creating another profile, not a code change.
 */
export class WakeWordProfile {
  public readonly id: string;
  public readonly name: string;
  public readonly wakeWordPhrase: string;
  public readonly sensitivity: number;
  public readonly confidenceThreshold: number;
  public readonly cooldownMs: number;
  public readonly secureWakeLevel: SecureWakeLevel;
  public enabled: boolean;

  constructor(input: WakeWordProfileInput = {}) {
    this.id = generateId();
    this.name = input.name ?? 'default';
    this.wakeWordPhrase = input.wakeWordPhrase ?? 'Jarvis';

    this.sensitivity = input.sensitivity ?? 0.5;
    this.confidenceThreshold = input.confidenceThreshold ?? 0.6;
    if (this.sensitivity < 0 || this.sensitivity > 1) {
      throw new WakeWordProfileError('sensitivity must be between 0 and 1', {
        sensitivity: this.sensitivity,
      });
    }
    if (this.confidenceThreshold < 0 || this.confidenceThreshold > 1) {
      throw new WakeWordProfileError('confidenceThreshold must be between 0 and 1', {
        confidenceThreshold: this.confidenceThreshold,
      });
    }

    this.cooldownMs = input.cooldownMs ?? 1500;
    this.secureWakeLevel = input.secureWakeLevel ?? 'standard';
    this.enabled = input.enabled ?? true;
  }
}
