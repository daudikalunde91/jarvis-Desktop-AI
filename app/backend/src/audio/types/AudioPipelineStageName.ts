/**
 * The eight stages of the audio pipeline this milestone architects.
 * Order matters: it is the default processing order AudioManager applies
 * when routing a chunk through registered stages.
 */
export const AUDIO_PIPELINE_STAGE_NAMES = [
  'microphone-input',
  'audio-buffer',
  'noise-reduction',
  'echo-cancellation',
  'wake-word-routing',
  'speech-to-text-routing',
  'voice-output-routing',
  'speaker-output',
] as const;
export type AudioPipelineStageName = (typeof AUDIO_PIPELINE_STAGE_NAMES)[number];
