import type { AudioDeviceType } from '@backend/audio/types/AudioDeviceType';
import type { AudioConnectionType } from '@backend/audio/types/AudioConnectionType';
import type { AudioFormat } from '@backend/audio/types/AudioFormat';

/**
 * Descriptor for a microphone or speaker. No hardware SDK is implemented
 * or referenced — this is the shape a future device-discovery provider
 * will populate.
 */
export interface IAudioDevice {
  id: string;
  name: string;
  type: AudioDeviceType;
  connection: AudioConnectionType;
  isDefault: boolean;
  supportedFormats: AudioFormat[];
}
