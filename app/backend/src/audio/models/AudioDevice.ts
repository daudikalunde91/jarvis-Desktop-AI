import type { IAudioDevice } from '@backend/audio/interfaces/IAudioDevice';
import type { AudioDeviceType } from '@backend/audio/types/AudioDeviceType';
import type { AudioConnectionType } from '@backend/audio/types/AudioConnectionType';
import type { AudioFormat } from '@backend/audio/types/AudioFormat';

export interface AudioDeviceInput {
  id: string;
  name: string;
  type: AudioDeviceType;
  connection: AudioConnectionType;
  isDefault?: boolean;
  supportedFormats?: AudioFormat[];
}

/**
 * Concrete AudioDevice descriptor. Purely data — no hardware SDK, no
 * capture/playback capability, populated later by a real device-discovery
 * provider (out of scope for this milestone).
 */
export class AudioDevice implements IAudioDevice {
  public readonly id: string;
  public readonly name: string;
  public readonly type: AudioDeviceType;
  public readonly connection: AudioConnectionType;
  public isDefault: boolean;
  public readonly supportedFormats: AudioFormat[];

  constructor(input: AudioDeviceInput) {
    this.id = input.id;
    this.name = input.name;
    this.type = input.type;
    this.connection = input.connection;
    this.isDefault = input.isDefault ?? false;
    this.supportedFormats = input.supportedFormats ?? [
      { sampleRateHz: 16000, channels: 1, bitDepth: 16 },
    ];
  }
}
