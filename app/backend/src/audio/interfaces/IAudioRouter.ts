import type { IAudioChunk } from '@backend/audio/interfaces/IAudioChunk';

export type AudioRouteHandler = (chunk: IAudioChunk) => void | Promise<void>;

/**
 * Routes audio data between pipeline participants. Transport only — it
 * never inspects payload contents or applies business/AI logic, mirroring
 * the Communication Bus / Event System boundary established in
 * Milestone 2.
 */
export interface IAudioRouter {
  routeMicrophoneData(chunk: IAudioChunk): void;
  routeWakeWordData(chunk: IAudioChunk): void;
  routeSpeechData(chunk: IAudioChunk): void;
  routeTTSOutput(chunk: IAudioChunk): void;
  routeMonitoringData(chunk: IAudioChunk): void;

  onMicrophoneData(handler: AudioRouteHandler): () => void;
  onWakeWordData(handler: AudioRouteHandler): () => void;
  onSpeechData(handler: AudioRouteHandler): () => void;
  onTTSOutput(handler: AudioRouteHandler): () => void;
  onMonitoringData(handler: AudioRouteHandler): () => void;

  /** Registers an additional custom route for future routing rules. */
  addRoute(channel: string, handler: AudioRouteHandler): () => void;
  route(channel: string, chunk: IAudioChunk): void;
}
