import fs from 'node:fs';
import path from 'node:path';

import { IntegrationError } from '@backend/integrations/errors';
import type { ICredentialStore, ISecretCipher } from '@backend/integrations/credentials/ICredentialStore';

/**
 * File-backed credential store. Each value is encrypted with the injected
 * OS-bound cipher before touching disk; the file only contains ciphertext
 * (base64) keyed by credential name. No plaintext fallback exists: if the
 * cipher is unavailable, `set` throws INVALID_CONFIGURATION.
 */
export class EncryptedFileCredentialStore implements ICredentialStore {
  constructor(
    private readonly filePath: string,
    private readonly cipher: ISecretCipher,
  ) {}

  private readAll(): Record<string, string> {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  private writeAll(data: Record<string, string>): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, this.filePath);
  }

  async get(key: string): Promise<string | null> {
    const encoded = this.readAll()[key];
    if (!encoded) return null;
    if (!this.cipher.isAvailable()) {
      throw new IntegrationError('INVALID_CONFIGURATION', 'Secure credential storage is unavailable.');
    }
    try {
      return this.cipher.decrypt(Buffer.from(encoded, 'base64'));
    } catch {
      // Undecryptable (e.g. different OS user): treat as absent, never expose details.
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    if (!this.cipher.isAvailable()) {
      throw new IntegrationError('INVALID_CONFIGURATION', 'Secure credential storage is unavailable; refusing to store credentials.');
    }
    const all = this.readAll();
    all[key] = this.cipher.encrypt(value).toString('base64');
    this.writeAll(all);
  }

  async delete(key: string): Promise<void> {
    const all = this.readAll();
    if (key in all) {
      delete all[key];
      this.writeAll(all);
    }
  }

  async has(key: string): Promise<boolean> {
    return typeof this.readAll()[key] === 'string';
  }
}
