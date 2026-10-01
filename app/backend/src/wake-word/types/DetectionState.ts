/**
 * Runtime detection state of the wake-word subsystem. Distinct from
 * `ModuleStatus` (which describes the *manager's* lifecycle) — this
 * describes what the *listening loop* is currently doing.
 */
export const DETECTION_STATES = ['idle', 'listening', 'triggered', 'cooldown', 'disabled'] as const;
export type DetectionState = (typeof DETECTION_STATES)[number];
