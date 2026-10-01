import type { IAudioPipelineStage } from '@backend/audio/interfaces/IAudioPipelineStage';

/** Marker contract only — real noise reduction is a future provider's job. */
export interface INoiseReductionStage extends IAudioPipelineStage {
  readonly name: 'noise-reduction';
}
