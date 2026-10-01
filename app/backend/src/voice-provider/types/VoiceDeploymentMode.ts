/** Whether a voice provider runs locally or calls a cloud service. */
export const VOICE_DEPLOYMENT_MODES = ['offline', 'cloud', 'hybrid'] as const;
export type VoiceDeploymentMode = (typeof VOICE_DEPLOYMENT_MODES)[number];
