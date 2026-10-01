import type { SecureWakeLevel } from '@backend/wake-word/types/SecureWakeLevel';

export interface VoiceVerificationRequest {
  sessionId: string;
  requiredLevel: SecureWakeLevel;
}

export interface VoiceVerificationResult {
  verified: boolean;
  level: SecureWakeLevel | null;
}

/**
 * Contract for a future Secure Wake Mode verifier (voice identity /
 * biometric verification before high-risk operations proceed). No
 * verification logic — voice biometrics or otherwise — is implemented
 * anywhere in this project. `WakeWordManager` accepts this as an
 * optional dependency and never calls it today.
 */
export interface ITrustedVoiceVerifier {
  verify(request: VoiceVerificationRequest): Promise<VoiceVerificationResult>;
}
