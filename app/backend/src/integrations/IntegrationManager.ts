import type { ILogger } from '@backend/logging/ILogger';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { IHealthCheckable } from '@backend/shared/interfaces/IHealthCheckable';
import type { IntegrationCapability } from '@backend/integrations/capabilities';
import { IntegrationError, toIntegrationError } from '@backend/integrations/errors';
import type { IntegrationGrantStore } from '@backend/integrations/credentials/IntegrationGrantStore';
import type {
  HealthState,
  IIntegrationProvider,
  IntegrationId,
  IntegrationOperationResult,
  IntegrationStatus,
} from '@backend/integrations/types';

/**
 * Registers providers, enforces capability grants, routes operations and
 * reports safe errors. Holds NO credentials: providers own token handling.
 */
export class IntegrationManager implements IHealthCheckable {
  private readonly providers = new Map<IntegrationId, IIntegrationProvider>();
  private readonly health = new Map<IntegrationId, HealthState>();

  constructor(
    private readonly logger: ILogger,
    private readonly grants: IntegrationGrantStore,
  ) {}

  register(provider: IIntegrationProvider): void {
    if (this.providers.has(provider.id)) {
      this.logger.warn(`Integration already registered: ${provider.id}`);
      return;
    }
    this.providers.set(provider.id, provider);
  }

  has(id: IntegrationId): boolean {
    return this.providers.has(id);
  }

  /** All `${id}.${operation}` action ids across registered providers. */
  listActions(): string[] {
    return [...this.providers.values()].flatMap((p) => p.operations.map((o) => `${p.id}.${o.name}`));
  }

  async getStatus(id: IntegrationId): Promise<IntegrationStatus> {
    const p = this.require(id);
    const configuration = p.getConfigurationState();
    const authorization = configuration === 'READY' ? await p.getAuthorization() : 'NOT_CONNECTED';
    return {
      id: p.id,
      name: p.name,
      implementation: p.implementation,
      configuration,
      authorization,
      health: this.health.get(id) ?? 'UNKNOWN',
      grantedCapabilities: authorization === 'NOT_CONNECTED' ? [] : this.grants.get(id),
      availableCapabilities: p.capabilities(),
    };
  }

  async getAllStatuses(): Promise<IntegrationStatus[]> {
    return Promise.all([...this.providers.keys()].map((id) => this.getStatus(id)));
  }

  /** User-initiated only (IPC from the UI). Never exposed as an AI tool. */
  async connect(id: IntegrationId, capabilities: readonly IntegrationCapability[]): Promise<IntegrationStatus> {
    const p = this.require(id);
    const allowed = new Set(p.capabilities());
    const requested = [...new Set(capabilities)];
    if (requested.length === 0 || requested.some((c) => !allowed.has(c))) throw new IntegrationError('INVALID_REQUEST');
    try {
      await p.connect(requested);
    } catch (error) {
      throw this.safe(id, 'connect', error);
    }
    this.grants.set(id, requested);
    this.health.set(id, 'UNKNOWN');
    this.logger.info(`Integration connected: ${id}`, { capabilities: requested });
    return this.getStatus(id);
  }

  async disconnect(id: IntegrationId): Promise<IntegrationStatus> {
    const p = this.require(id);
    try {
      await p.disconnect();
    } finally {
      this.grants.clear(id);
      this.health.set(id, 'UNKNOWN');
    }
    this.logger.info(`Integration disconnected: ${id}`);
    return this.getStatus(id);
  }

  async checkHealth(id: IntegrationId): Promise<HealthState> {
    const p = this.require(id);
    let state: HealthState = 'UNKNOWN';
    if (p.getConfigurationState() === 'READY' && (await p.getAuthorization()) === 'CONNECTED') {
      try {
        await p.healthCheck();
        state = 'HEALTHY';
      } catch {
        state = 'ERROR';
      }
    }
    this.health.set(id, state);
    return state;
  }

  /**
   * Route one operation. Order: configured -> capability granted -> run.
   * Authorization (token) problems surface from the provider as AUTH_REQUIRED / AUTH_EXPIRED.
   */
  async execute(action: string, params: Record<string, unknown> = {}): Promise<IntegrationOperationResult> {
    const dot = action.indexOf('.');
    const id = action.slice(0, dot) as IntegrationId;
    const opName = action.slice(dot + 1);
    const p = this.providers.get(id);
    const op = p?.operations.find((o) => o.name === opName);
    if (!p || !op) throw new IntegrationError('NOT_FOUND', `Unknown integration action "${action}".`);

    if (p.getConfigurationState() !== 'READY') throw new IntegrationError('INVALID_CONFIGURATION');
    if ((await p.getAuthorization()) === 'NOT_CONNECTED') throw new IntegrationError('AUTH_REQUIRED');
    if (!this.grants.get(id).includes(op.capability)) {
      throw new IntegrationError('PERMISSION_DENIED', `The "${op.capability}" permission has not been granted. Connect ${p.name} with that permission to use it.`);
    }
    try {
      return await op.run(params);
    } catch (error) {
      throw this.safe(id, opName, error);
    }
  }

  healthCheck(): ModuleStatus {
    return this.providers.size > 0 ? 'running' : 'stopped';
  }

  private require(id: IntegrationId): IIntegrationProvider {
    const p = this.providers.get(id);
    if (!p) throw new IntegrationError('NOT_FOUND', `Unknown integration "${id}".`);
    return p;
  }

  /** Log only the normalized code, never the raw error (which could carry sensitive context). */
  private safe(id: IntegrationId, op: string, error: unknown): IntegrationError {
    const normalized = toIntegrationError(error);
    this.logger.warn(`Integration ${id}.${op} failed`, { code: normalized.integrationCode });
    return normalized;
  }
}
