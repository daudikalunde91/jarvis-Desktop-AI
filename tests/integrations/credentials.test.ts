import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EncryptedFileCredentialStore } from '@backend/integrations/credentials/EncryptedFileCredentialStore';
import { IntegrationGrantStore } from '@backend/integrations/credentials/IntegrationGrantStore';
import { FakeCipher, tmpDir } from '../support/integrationFakes';

describe('EncryptedFileCredentialStore', () => {
  it('never writes plaintext to disk and round-trips', async () => {
    const file = path.join(tmpDir(), 'c.json');
    const store = new EncryptedFileCredentialStore(file, new FakeCipher());
    await store.set('k', 'refresh-token-PLAINTEXT');
    expect(fs.readFileSync(file, 'utf8').includes('PLAINTEXT')).toBe(false);
    expect(await store.get('k')).toBe('refresh-token-PLAINTEXT');
    expect(await store.has('k')).toBe(true);
    await store.delete('k');
    expect(await store.get('k')).toBeNull();
  });

  it('refuses to store when OS encryption is unavailable (no plaintext fallback)', async () => {
    const file = path.join(tmpDir(), 'c.json');
    const store = new EncryptedFileCredentialStore(file, new FakeCipher(false));
    await expect(store.set('k', 'secret')).rejects.toMatchObject({ integrationCode: 'INVALID_CONFIGURATION' });
    expect(fs.existsSync(file)).toBe(false);
  });
});

describe('IntegrationGrantStore', () => {
  it('stores only capability names and drops unknown values', () => {
    const file = path.join(tmpDir(), 'g.json');
    const g = new IntegrationGrantStore(file);
    g.set('gmail', ['gmail.read']);
    fs.writeFileSync(file, JSON.stringify({ gmail: ['gmail.read', 'bogus.admin'] }));
    expect(g.get('gmail')).toEqual(['gmail.read']);
    g.clear('gmail');
    expect(g.get('gmail')).toEqual([]);
  });
});
