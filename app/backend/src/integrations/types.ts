import type { IntegrationCapability } from '@backend/integrations/capabilities';

export const INTEGRATION_IDS = [
  'gmail',
  'calendar',
  'drive',
  'whatsapp',
  'outlook',
  'onedrive',
  'telegram',
  'discord',
] as const;
export type IntegrationId = (typeof INTEGRATION_IDS)[number];

/** Honest implementation level, shown in docs/UI. Scaffolding is never "complete". */
export type ImplementationLevel = 'IMPLEMENTED' | 'PARTIAL' | 'SCAFFOLDING' | 'NOT_IMPLEMENTED';
export type ConfigurationState = 'READY' | 'MISSING' | 'DISABLED';
export type AuthorizationState = 'CONNECTED' | 'NOT_CONNECTED' | 'EXPIRED';
export type HealthState = 'HEALTHY' | 'ERROR' | 'UNKNOWN';

/** Renderer-safe status. Contains NO tokens, secrets or account data. */
export interface IntegrationStatus {
  readonly id: IntegrationId;
  readonly name: string;
  readonly implementation: ImplementationLevel;
  readonly configuration: ConfigurationState;
  readonly authorization: AuthorizationState;
  readonly health: HealthState;
  readonly grantedCapabilities: readonly IntegrationCapability[];
  readonly availableCapabilities: readonly IntegrationCapability[];
}

/** One executable operation. Action id is `${integrationId}.${name}`. */
export interface IntegrationOperation {
  readonly name: string;
  readonly capability: IntegrationCapability;
  run(params: Record<string, unknown>): Promise<IntegrationOperationResult>;
}

export interface IntegrationOperationResult {
  /** Short, speakable summary for the user / AI. */
  readonly summary: string;
  readonly data?: unknown;
}

export interface IIntegrationProvider {
  readonly id: IntegrationId;
  readonly name: string;
  readonly implementation: ImplementationLevel;
  readonly operations: readonly IntegrationOperation[];
  capabilities(): readonly IntegrationCapability[];
  /** OAuth scopes needed for the requested capabilities (least privilege). */
  requiredScopes(capabilities: readonly IntegrationCapability[]): readonly string[];
  getConfigurationState(): ConfigurationState;
  getAuthorization(): Promise<AuthorizationState>;
  /** Runs the user-approved authorization flow and stores credentials securely. */
  connect(capabilities: readonly IntegrationCapability[]): Promise<void>;
  /** Revokes (best effort) and deletes stored credentials. */
  disconnect(): Promise<void>;
  /** Cheap authenticated call. Throws IntegrationError on failure. */
  healthCheck(): Promise<void>;
}
