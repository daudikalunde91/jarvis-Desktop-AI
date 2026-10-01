import type { ILogger } from '@backend/logging/ILogger';
import type { IWakeWordProvider } from '@backend/wake-word/interfaces/IWakeWordProvider';
import type { IWakeWordProviderRegistry } from '@backend/wake-word/interfaces/IWakeWordProviderRegistry';
import { WakeWordRegistryError } from '@backend/wake-word/errors/WakeWordError';

/**
 * In-memory catalog of wake-word providers, keyed by id. No provider is
 * registered by default anywhere in this project — this registry exists
 * so a future milestone has somewhere to register a real engine.
 */
export class WakeWordProviderRegistry implements IWakeWordProviderRegistry {
  private readonly providers = new Map<string, IWakeWordProvider>();

  constructor(private readonly logger: ILogger) {}

  register(provider: IWakeWordProvider): void {
    if (this.providers.has(provider.id)) {
      throw new WakeWordRegistryError(`Wake-word provider "${provider.id}" is already registered`, {
        id: provider.id,
      });
    }
    this.providers.set(provider.id, provider);
    this.logger.info(`Wake-word provider registered: ${provider.name} (${provider.id})`);
  }

  unregister(providerId: string): void {
    if (!this.providers.has(providerId)) {
      throw new WakeWordRegistryError(
        `Cannot unregister unknown wake-word provider "${providerId}"`,
        {
          providerId,
        },
      );
    }
    this.providers.delete(providerId);
  }

  get(providerId: string): IWakeWordProvider | undefined {
    return this.providers.get(providerId);
  }

  list(): IWakeWordProvider[] {
    return Array.from(this.providers.values());
  }

  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }
}
