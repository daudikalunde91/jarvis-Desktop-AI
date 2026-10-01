import type { IAudioPipelineStage } from '@backend/audio/interfaces/IAudioPipelineStage';

/** Marker contract only — real echo cancellation is a future provider's job. */
export interface IEchoCancellationStage extends IAudioPipelineStage {
  readonly name: 'echo-cancellation';
}
