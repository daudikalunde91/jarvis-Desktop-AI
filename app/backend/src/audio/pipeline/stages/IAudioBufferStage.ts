import type { IAudioPipelineStage } from '@backend/audio/interfaces/IAudioPipelineStage';

export interface IAudioBufferStage extends IAudioPipelineStage {
  readonly name: 'audio-buffer';
}
