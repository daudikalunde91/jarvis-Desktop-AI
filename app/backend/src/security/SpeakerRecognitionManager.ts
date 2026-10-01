/**
 * Speaker Recognition (trusted-voice) foundation.
 *
 * Keeps the *decision* logic (is this speaker authorized?) separate from
 * any future biometric embedding engine. A real verifier registers an
 * `ISpeakerVerifier`; with none registered the manager falls back to the
 * configured `defaultTrust`, so the rest of the system behaves
 * identically whether or not biometrics exist.
 */
import type { ILogger } from '@backend/logging/ILogger';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { IHealthCheckable } from '@backend/shared/interfaces/IHealthCheckable';
import { SpeakerNotAuthorizedError } from '@backend/security/errors/SecurityError';

export interface SpeakerVerification {
  readonly speakerId: string | null;
  readonly authorized: boolean;
  readonly confidence: number;
  readonly reason: string;
}

export interface ISpeakerVerifier {
  readonly id: string;
  verify(sample: Uint8Array): SpeakerVerification | Promise<SpeakerVerification>;
}

export class SpeakerRecognitionManager implements IHealthCheckable {
  private verifier: ISpeakerVerifier | null = null;

  constructor(
    private readonly logger: ILogger,
    private readonly defaultTrust: boolean = true,
    private readonly minimumConfidence: number = 0.6,
  ) {}

  registerVerifier(verifier: ISpeakerVerifier): void {
    this.verifier = verifier;
    this.logger.info(`Speaker verifier registered: ${verifier.id}`);
  }

  clearVerifier(): void {
    this.verifier = null;
  }

  async verify(sample?: Uint8Array): Promise<SpeakerVerification> {
    if (!this.verifier || !sample) {
      return {
        speakerId: null,
        authorized: this.defaultTrust,
        confidence: this.defaultTrust ? 1 : 0,
        reason: 'No speaker verifier registered — falling back to configured default trust',
      };
    }

    const result = await this.verifier.verify(sample);
    if (result.authorized && result.confidence < this.minimumConfidence) {
      return {
        ...result,
        authorized: false,
        reason: `Confidence ${result.confidence.toFixed(2)} below minimum ${this.minimumConfidence}`,
      };
    }
    return result;
  }

  async requireAuthorized(sample?: Uint8Array): Promise<SpeakerVerification> {
    const result = await this.verify(sample);
    if (!result.authorized) {
      throw new SpeakerNotAuthorizedError(result.reason, { speakerId: result.speakerId });
    }
    return result;
  }

  healthCheck(): ModuleStatus {
    return 'running';
  }
}
