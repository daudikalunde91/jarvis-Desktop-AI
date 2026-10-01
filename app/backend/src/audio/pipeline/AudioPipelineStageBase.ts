import { BaseService } from '@backend/shared/base/BaseService';
import type { IAudioPipelineStage } from '@backend/audio/interfaces/IAudioPipelineStage';
import type { IAudioChunk } from '@backend/audio/interfaces/IAudioChunk';
import type { AudioPipelineStageName } from '@backend/audio/types/AudioPipelineStageName';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { ILogger } from '@backend/logging/ILogger';

/**
 * Reusable base for future concrete pipeline stages. Default `process()`
 * is a pass-through (returns the chunk unchanged) so a minimal stage only
 * needs to override what it actually does — matching the BaseAgent /
 * BasePlugin pattern from Milestone 2. No stage subclass with real DSP,
 * ML, or hardware logic exists in this milestone.
 */
export abstract class AudioPipelineStageBase extends BaseService implements IAudioPipelineStage {
  protected constructor(
    logger: ILogger,
    public readonly name: AudioPipelineStageName,
  ) {
    super(logger, `AudioPipelineStage(${name})`);
  }

  initialize(): void | Promise<void> {
    this.logger.debug(`Stage "${this.name}" initialize() not overridden — default no-op`);
  }

  process(chunk: IAudioChunk): IAudioChunk | null | Promise<IAudioChunk | null> {
    return chunk;
  }

  dispose(): void | Promise<void> {
    this.logger.debug(`Stage "${this.name}" dispose() not overridden — default no-op`);
  }

  healthCheck(): ModuleStatus | Promise<ModuleStatus> {
    return 'running';
  }
}
