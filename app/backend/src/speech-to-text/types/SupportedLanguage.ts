/**
 * First-class languages JARVIS explicitly targets. English and Swahili
 * are both first-class — Swahili is not an afterthought (see
 * MILESTONE_3_2_SPEECH_TO_TEXT_ARCHITECTURE.md). Any other BCP-47 code
 * is still accepted structurally (`language` fields are typed `string`)
 * — this list documents the languages the architecture is validated
 * against, not a hard allowlist.
 */
export const FIRST_CLASS_LANGUAGES = ['en-US', 'sw-KE'] as const;
export type FirstClassLanguage = (typeof FIRST_CLASS_LANGUAGES)[number];
