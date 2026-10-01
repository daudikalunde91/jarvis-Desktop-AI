import { generateId } from '@backend/shared/utilities/generateId';
import type { VoiceGender } from '@backend/voice-provider/types/VoiceGender';
import { VoiceProfileError } from '@backend/voice-provider/errors/VoiceProviderError';

export interface VoiceMetadata {
  description: string;
  sampleRateHz: number;
  previewText: string;
}

export interface VoiceProfileInput {
  name?: string;
  gender?: VoiceGender;
  language?: string;
  /** Free-form style descriptors, e.g. ["natural","calm","professional","friendly","clear"]. */
  styleTags?: string[];
  providerId?: string | null;
  metadata?: Partial<VoiceMetadata>;
  enabled?: boolean;
}

/**
 * A configurable output-voice profile. The project-wide default is
 * female, natural, calm, professional, friendly, and clear/human-like
 * (see MILESTONE_3_1_VOICE_PROVIDER_ARCHITECTURE.md) — but nothing here
 * hardcodes JARVIS to one provider or one voice permanently; profiles
 * are data, selected through configuration.
 */
export class VoiceProfile {
  public readonly id: string;
  public readonly name: string;
  public readonly gender: VoiceGender;
  public readonly language: string;
  public readonly styleTags: string[];
  public readonly providerId: string | null;
  public readonly metadata: VoiceMetadata;
  public enabled: boolean;

  constructor(input: VoiceProfileInput = {}) {
    this.id = generateId();
    this.name = input.name ?? 'jarvis-default';
    this.gender = input.gender ?? 'female';
    this.language = input.language ?? 'en-US';
    this.styleTags = input.styleTags ?? ['natural', 'calm', 'professional', 'friendly', 'clear'];
    this.providerId = input.providerId ?? null;
    this.enabled = input.enabled ?? true;

    if (this.styleTags.length === 0) {
      throw new VoiceProfileError('A voice profile must declare at least one style tag');
    }

    this.metadata = {
      description:
        input.metadata?.description ?? 'Default JARVIS voice — natural, calm, and professional.',
      sampleRateHz: input.metadata?.sampleRateHz ?? 24000,
      previewText: input.metadata?.previewText ?? 'Hello, I am JARVIS.',
    };
  }
}
