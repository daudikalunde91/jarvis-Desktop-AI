import type { ILogger } from '@backend/logging/ILogger';
import type { ISpeechProvider } from '@backend/speech-to-text/interfaces/ISpeechProvider';
import type { ISpeechProviderRegistry } from '@backend/speech-to-text/interfaces/ISpeechProviderRegistry';
import { SpeechRegistryError } from '@backend/speech-to-text/errors/SpeechError';

/** In-memory catalog of STT providers, keyed by id. None registered by default. */
export class SpeechProviderRegistry implements ISpeechProviderRegistry {
  private readonly providers = new Map<string, ISpeechProvider>();

  constructor(private readonly logger: ILogger) {}

  register(provider: ISpeechProvider): void {
    if (this.providers.has(provider.id)) {
      throw new SpeechRegistryError(`Speech provider "${provider.id}" is already registered`, {
        id: provider.id,
      });
    }
    this.providers.set(provider.id, provider);
    this.logger.info(`Speech provider registered: ${provider.name} (${provider.id})`);
  }

  unregister(providerId: string): void {
    if (!this.providers.has(providerId)) {
      throw new SpeechRegistryError(`Cannot unregister unknown speech provider "${providerId}"`, {
        providerId,
      });
    }
    this.providers.delete(providerId);
  }

  get(providerId: string): ISpeechProvider | undefined {
    return this.providers.get(providerId);
  }

  list(): ISpeechProvider[] {
    return Array.from(this.providers.values());
  }

  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }
}
