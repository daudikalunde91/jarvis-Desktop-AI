import type { IAudioPipelineStage } from '@backend/audio/interfaces/IAudioPipelineStage';

/** Marker contract only — real speaker/hardware output is a future provider's job. */
export interface ISpeakerOutputStage extends IAudioPipelineStage {
  readonly name: 'speaker-output';
}
