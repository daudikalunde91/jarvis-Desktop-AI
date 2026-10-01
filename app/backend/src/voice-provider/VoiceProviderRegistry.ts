import type { ILogger } from '@backend/logging/ILogger';
import type { IVoiceProvider } from '@backend/voice-provider/interfaces/IVoiceProvider';
import type { IVoiceProviderRegistry } from '@backend/voice-provider/interfaces/IVoiceProviderRegistry';
import { VoiceProviderRegistryError } from '@backend/voice-provider/errors/VoiceProviderError';

/** In-memory catalog of TTS providers, keyed by id. None registered by default. */
export class VoiceProviderRegistry implements IVoiceProviderRegistry {
  private readonly providers = new Map<string, IVoiceProvider>();

  constructor(private readonly logger: ILogger) {}

  register(provider: IVoiceProvider): void {
    if (this.providers.has(provider.id)) {
      throw new VoiceProviderRegistryError(
        `Voice provider "${provider.id}" is already registered`,
        {
          id: provider.id,
        },
      );
    }
    this.providers.set(provider.id, provider);
    this.logger.info(`Voice provider registered: ${provider.name} (${provider.id})`);
  }

  unregister(providerId: string): void {
    if (!this.providers.has(providerId)) {
      throw new VoiceProviderRegistryError(
        `Cannot unregister unknown voice provider "${providerId}"`,
        {
          providerId,
        },
      );
    }
    this.providers.delete(providerId);
  }

  get(providerId: string): IVoiceProvider | undefined {
    return this.providers.get(providerId);
  }

  list(): IVoiceProvider[] {
    return Array.from(this.providers.values());
  }

  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }
}
