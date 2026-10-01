import type { ISecretCipher } from '@backend/integrations/credentials/ICredentialStore';

/** Subset of Electron's `safeStorage` we depend on (keeps this testable). */
export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(data: Buffer): string;
}

/** Windows: backed by DPAPI via Electron safeStorage. Main process only. */
export class ElectronSafeStorageCipher implements ISecretCipher {
  constructor(private readonly safeStorage: SafeStorageLike) {}
  isAvailable(): boolean {
    return this.safeStorage.isEncryptionAvailable();
  }
  encrypt(plain: string): Buffer {
    return this.safeStorage.encryptString(plain);
  }
  decrypt(data: Buffer): string {
    return this.safeStorage.decryptString(data);
  }
}
