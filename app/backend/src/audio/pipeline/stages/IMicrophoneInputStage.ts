import type { IAudioPipelineStage } from '@backend/audio/interfaces/IAudioPipelineStage';

/**
 * Marker contract for a microphone-input stage. No implementation exists
 * in this milestone — capturing real audio is explicitly out of scope.
 */
export interface IMicrophoneInputStage extends IAudioPipelineStage {
  readonly name: 'microphone-input';
}
