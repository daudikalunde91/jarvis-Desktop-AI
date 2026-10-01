/**
 * Secure secret storage boundary. Implementations MUST encrypt at rest
 * and MUST refuse to store when encryption is unavailable (no plaintext fallback).
 * Values are opaque strings (serialized token sets). Never log them.
 */
export interface ICredentialStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** Existence check that does not decrypt (used by doctor / status). */
  has(key: string): Promise<boolean>;
}

/** Symmetric OS-bound cipher (Electron safeStorage / Windows DPAPI in production). */
export interface ISecretCipher {
  isAvailable(): boolean;
  encrypt(plain: string): Buffer;
  decrypt(data: Buffer): string;
}
