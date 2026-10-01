/** The four provider-facing subsystems the runtime connects. */
export const VOICE_SUBSYSTEM_NAMES = ['audio', 'wake-word', 'speech', 'voice'] as const;
export type VoiceSubsystemName = (typeof VOICE_SUBSYSTEM_NAMES)[number];
