import type { IAudioChunk } from '@backend/audio/interfaces/IAudioChunk';
import type { AudioPipelineStageName } from '@backend/audio/types/AudioPipelineStageName';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';

/**
 * Contract every pipeline stage (microphone input, buffer, noise
 * reduction, echo cancellation, speaker output, ...) must satisfy.
 * `process()` may transform, pass through, or swallow a chunk — this
 * milestone defines the contract only; concrete provider logic (real
 * noise reduction, real echo cancellation, ...) is out of scope.
 */
export interface IAudioPipelineStage {
  readonly name: AudioPipelineStageName;
  initialize(): void | Promise<void>;
  process(chunk: IAudioChunk): IAudioChunk | null | Promise<IAudioChunk | null>;
  dispose(): void | Promise<void>;
  healthCheck(): ModuleStatus | Promise<ModuleStatus>;
}
