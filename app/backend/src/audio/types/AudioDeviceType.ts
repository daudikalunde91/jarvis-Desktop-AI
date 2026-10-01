/** Whether a device captures audio in or plays audio out. */
export const AUDIO_DEVICE_TYPES = ['input', 'output'] as const;
export type AudioDeviceType = (typeof AUDIO_DEVICE_TYPES)[number];
