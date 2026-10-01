/** Default JARVIS output voice preference is 'female' (see MILESTONE_3_1_VOICE_PROVIDER_ARCHITECTURE.md). */
export const VOICE_GENDERS = ['female', 'male', 'neutral'] as const;
export type VoiceGender = (typeof VOICE_GENDERS)[number];
