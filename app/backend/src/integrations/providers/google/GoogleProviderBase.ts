import { IntegrationError } from '@backend/integrations/errors';
import type { IntegrationCapability } from '@backend/integrations/capabilities';
import type { IntegrationHttpClient, HttpRequest } from '@backend/integrations/http/IntegrationHttpClient';
import { GOOGLE_AUTH_URL, type GoogleOAuthClient } from '@backend/integrations/oauth/GoogleOAuthClient';
import { authorizeViaLoopback } from '@backend/integrations/oauth/LoopbackAuthorizer';
import type { TokenManager } from '@backend/integrations/oauth/TokenManager';
import type {
  AuthorizationState,
  ConfigurationState,
  IIntegrationProvider,
  ImplementationLevel,
  IntegrationId,
  IntegrationOperation,
} from '@backend/integrations/types';

export interface GoogleProviderDeps {
  readonly enabled: boolean;
  readonly configured: boolean;
  readonly oauth: GoogleOAuthClient;
  readonly tokens: TokenManager;
  readonly http: IntegrationHttpClient;
  readonly openExternal: (url: string) => Promise<void>;
}

/**
 * Shared Google plumbing: consent flow, token use, one-shot refresh on 401.
 * Concrete providers only declare scopes and operations.
 */
export abstract class GoogleProviderBase implements IIntegrationProvider {
  abstract readonly id: IntegrationId;
  abstract readonly name: string;
  abstract readonly implementation: ImplementationLevel;
  abstract readonly operations: readonly IntegrationOperation[];
  protected abstract readonly scopeMap: Readonly<Record<string, string>>;
  protected abstract healthUrl(): string;

  constructor(protected readonly deps: GoogleProviderDeps) {}

  capabilities(): readonly IntegrationCapability[] {
    return Object.keys(this.scopeMap) as IntegrationCapability[];
  }

  requiredScopes(capabilities: readonly IntegrationCapability[]): readonly string[] {
    return [...new Set(capabilities.map((c) => this.scopeMap[c]).filter((s): s is string => !!s))];
  }

  getConfigurationState(): ConfigurationState {
    if (!this.deps.enabled) return 'DISABLED';
    return this.deps.configured ? 'READY' : 'MISSING';
  }

  async getAuthorization(): Promise<AuthorizationState> {
    if (!(await this.deps.tokens.hasTokens())) return 'NOT_CONNECTED';
    return (await this.deps.tokens.isExpiredBeyondRepair()) ? 'EXPIRED' : 'CONNECTED';
  }

  async connect(capabilities: readonly IntegrationCapability[]): Promise<void> {
    if (this.getConfigurationState() !== 'READY') throw new IntegrationError('INVALID_CONFIGURATION');
    const scopes = this.requiredScopes(capabilities);
    if (scopes.length === 0) throw new IntegrationError('INVALID_REQUEST');

    const result = await authorizeViaLoopback({
      allowedOrigins: [new URL(GOOGLE_AUTH_URL).origin],
      openExternal: this.deps.openExternal,
      buildAuthUrl: ({ redirectUri, state, codeChallenge }) =>
        this.deps.oauth.buildAuthUrl({ redirectUri, scopes, state, codeChallenge }),
    });
    const tokens = await this.deps.oauth.exchangeCode({ ...result, scopes });
    if (!tokens.refreshToken) throw new IntegrationError('PROVIDER_ERROR');
    await this.deps.tokens.save(tokens);
  }

  async disconnect(): Promise<void> {
    const tokens = await this.deps.tokens.load();
    if (tokens) await this.deps.oauth.revoke(tokens.refreshToken ?? tokens.accessToken);
    await this.deps.tokens.clear();
  }

  async healthCheck(): Promise<void> {
    await this.api(this.healthUrl());
  }

  /** Authenticated JSON call. Refreshes once on 401 then surfaces AUTH_EXPIRED. */
  protected async api<T>(url: string, request: HttpRequest = {}): Promise<T | null> {
    const call = async (token: string) =>
      this.deps.http.requestJson<T>(url, {
        ...request,
        headers: { ...request.headers, Authorization: `Bearer ${token}` },
      });
    try {
      return await call(await this.deps.tokens.getAccessToken());
    } catch (error) {
      if (error instanceof IntegrationError && error.integrationCode === 'AUTH_EXPIRED') {
        return call(await this.deps.tokens.forceRefresh());
      }
      throw error;
    }
  }
}
