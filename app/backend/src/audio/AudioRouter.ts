import type { ILogger } from '@backend/logging/ILogger';
import type { IEventSystem } from '@backend/infrastructure/event-system';
import type { IAudioChunk } from '@backend/audio/interfaces/IAudioChunk';
import type { AudioRouteHandler, IAudioRouter } from '@backend/audio/interfaces/IAudioRouter';
import { AUDIO_CHANNELS } from '@backend/audio/channels/audioChannels';
import { AudioRoutingError } from '@backend/audio/errors/AudioError';

/**
 * Routes audio chunks between pipeline participants.
 *
 * Deliberately thin: every method below is a named wrapper around the
 * *existing* Event System (`IEventSystem.emit` / `.on`), the same way
 * `IpcRouter` wraps Electron's `ipcMain` in Milestone 1. AudioRouter adds
 * no new transport mechanism and no business/AI logic — it only gives
 * the five required audio data routes readable names and lets future
 * routing rules be added via `addRoute` without touching this class.
 */
export class AudioRouter implements IAudioRouter {
  private readonly customChannels = new Set<string>();

  constructor(
    private readonly logger: ILogger,
    private readonly eventSystem: IEventSystem,
  ) {}

  routeMicrophoneData(chunk: IAudioChunk): void {
    this.route(AUDIO_CHANNELS.MICROPHONE, chunk);
  }

  routeWakeWordData(chunk: IAudioChunk): void {
    this.route(AUDIO_CHANNELS.WAKE_WORD, chunk);
  }

  routeSpeechData(chunk: IAudioChunk): void {
    this.route(AUDIO_CHANNELS.SPEECH_TO_TEXT, chunk);
  }

  routeTTSOutput(chunk: IAudioChunk): void {
    this.route(AUDIO_CHANNELS.TTS_OUTPUT, chunk);
  }

  routeMonitoringData(chunk: IAudioChunk): void {
    this.route(AUDIO_CHANNELS.MONITORING, chunk);
  }

  onMicrophoneData(handler: AudioRouteHandler): () => void {
    return this.addRoute(AUDIO_CHANNELS.MICROPHONE, handler);
  }

  onWakeWordData(handler: AudioRouteHandler): () => void {
    return this.addRoute(AUDIO_CHANNELS.WAKE_WORD, handler);
  }

  onSpeechData(handler: AudioRouteHandler): () => void {
    return this.addRoute(AUDIO_CHANNELS.SPEECH_TO_TEXT, handler);
  }

  onTTSOutput(handler: AudioRouteHandler): () => void {
    return this.addRoute(AUDIO_CHANNELS.TTS_OUTPUT, handler);
  }

  onMonitoringData(handler: AudioRouteHandler): () => void {
    return this.addRoute(AUDIO_CHANNELS.MONITORING, handler);
  }

  addRoute(channel: string, handler: AudioRouteHandler): () => void {
    this.customChannels.add(channel);
    return this.eventSystem.on(channel, (event) => handler(event.payload as IAudioChunk));
  }

  route(channel: string, chunk: IAudioChunk): void {
    if (!chunk || !chunk.metadata) {
      throw new AudioRoutingError(`Cannot route an audio chunk without metadata on "${channel}"`, {
        channel,
      });
    }

    this.customChannels.add(channel);
    this.eventSystem.emit({
      name: channel,
      category: 'internal',
      priority: 'normal',
      timestamp: Date.now(),
      payload: chunk,
    });

    this.logger.debug(`Routed audio chunk on "${channel}"`, {
      sessionId: chunk.metadata.sessionId,
      sequence: chunk.metadata.sequence,
    });
  }

  /** Lists every channel that has ever been routed to or subscribed on. */
  listChannels(): string[] {
    return Array.from(this.customChannels);
  }
}
