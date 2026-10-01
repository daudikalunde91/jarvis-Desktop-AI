import path from 'node:path';

import type { ILogger } from '@backend/logging/ILogger';
import { EncryptedFileCredentialStore } from '@backend/integrations/credentials/EncryptedFileCredentialStore';
import type { ICredentialStore, ISecretCipher } from '@backend/integrations/credentials/ICredentialStore';
import { IntegrationGrantStore } from '@backend/integrations/credentials/IntegrationGrantStore';
import { IntegrationHttpClient, type FetchLike } from '@backend/integrations/http/IntegrationHttpClient';
import { IntegrationManager } from '@backend/integrations/IntegrationManager';
import { GoogleOAuthClient } from '@backend/integrations/oauth/GoogleOAuthClient';
import { TokenManager } from '@backend/integrations/oauth/TokenManager';
import { GmailProvider } from '@backend/integrations/providers/google/GmailProvider';
import { GoogleCalendarProvider } from '@backend/integrations/providers/google/GoogleCalendarProvider';
import type { GoogleProviderDeps } from '@backend/integrations/providers/google/GoogleProviderBase';

export interface CreateIntegrationsOptions {
  readonly logger: ILogger;
  /** Directory for non-secret grants + the encrypted credential file (Electron userData). */
  readonly dataDir: string;
  readonly cipher: ISecretCipher;
  readonly openExternal: (url: string) => Promise<void>;
  readonly env: {
    gmailEnabled?: boolean;
    calendarEnabled?: boolean;
    googleClientId?: string;
    googleClientSecret?: string;
  };
  readonly fetchImpl?: FetchLike;
  readonly credentialStore?: ICredentialStore;
}

/**
 * Composition root for Stage 7. Providers are registered even when not
 * configured so the UI/doctor can report MISSING/DISABLED honestly.
 * Google Drive, WhatsApp, Microsoft, Telegram, Discord are NOT registered yet (see docs/INTEGRATIONS.md).
 */
export function createIntegrations(options: CreateIntegrationsOptions): IntegrationManager {
  const { env } = options;
  const store = options.credentialStore ?? new EncryptedFileCredentialStore(path.join(options.dataDir, 'credentials.enc.json'), options.cipher);
  const grants = new IntegrationGrantStore(path.join(options.dataDir, 'integration-grants.json'));
  const manager = new IntegrationManager(options.logger, grants);

  const configured = !!env.googleClientId;
  const oauth = new GoogleOAuthClient({ clientId: env.googleClientId ?? '', clientSecret: env.googleClientSecret }, options.fetchImpl);
  const deps = (key: string, enabled: boolean): GoogleProviderDeps => ({
    enabled,
    configured,
    oauth,
    tokens: new TokenManager(key, store, oauth),
    http: new IntegrationHttpClient({ fetchImpl: options.fetchImpl }),
    openExternal: options.openExternal,
  });

  manager.register(new GmailProvider(deps('google:gmail', env.gmailEnabled ?? false)));
  manager.register(new GoogleCalendarProvider(deps('google:calendar', env.calendarEnabled ?? false)));
  return manager;
}
