/**
 * Permission levels for a future Secure Wake Mode (voice identity
 * verification before high-risk operations). No verification logic is
 * implemented anywhere in this project — this is the contract a future
 * milestone's verifier would be evaluated against.
 */
export const SECURE_WAKE_LEVELS = ['standard', 'elevated', 'critical'] as const;
export type SecureWakeLevel = (typeof SECURE_WAKE_LEVELS)[number];
