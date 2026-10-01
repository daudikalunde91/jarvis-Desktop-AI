/** Whether a provider delivers results incrementally or only once, at the end. */
export const TRANSCRIPTION_MODES = ['streaming', 'batch'] as const;
export type TranscriptionMode = (typeof TRANSCRIPTION_MODES)[number];
