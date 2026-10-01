import type { ILogger } from '@backend/logging/ILogger';
import type { IAIProvider } from '@backend/ai/interfaces/IAIProvider';

/** In-memory catalog of AI providers, keyed by id. Mirrors VoiceProviderRegistry's shape. */
export class ProviderRegistry {
  private readonly providers = new Map<string, IAIProvider>();

  constructor(private readonly logger: ILogger) {}

  register(provider: IAIProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`AI provider "${provider.id}" is already registered`);
    }
    this.providers.set(provider.id, provider);
    this.logger.info(`AI provider registered: ${provider.name} (${provider.id})`);
  }

  get(providerId: string): IAIProvider | undefined {
    return this.providers.get(providerId);
  }

  list(): IAIProvider[] {
    return Array.from(this.providers.values());
  }

  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }
}
