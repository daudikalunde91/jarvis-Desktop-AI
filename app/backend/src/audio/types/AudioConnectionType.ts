/**
 * Physical/logical connection kind. Prepared now so device management
 * already distinguishes Bluetooth/USB from built-in hardware — no actual
 * hardware or transport is implemented in this milestone.
 */
export const AUDIO_CONNECTION_TYPES = ['builtin', 'usb', 'bluetooth', 'virtual'] as const;
export type AudioConnectionType = (typeof AUDIO_CONNECTION_TYPES)[number];
