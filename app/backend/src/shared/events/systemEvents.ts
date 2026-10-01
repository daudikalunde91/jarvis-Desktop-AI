/**
 * Well-known event names emitted by the infrastructure layer itself
 * (Agent Manager, Health Monitor, ...) through the Event System. Kept
 * here — separate from the Event System engine — so any future module
 * can import the catalog without depending on the engine's
 * implementation.
 */
export const SYSTEM_EVENTS = {
  MODULE_LOADED: 'system.module.loaded',
  MODULE_UNLOADED: 'system.module.unloaded',
  MODULE_ENABLED: 'system.module.enabled',
  MODULE_DISABLED: 'system.module.disabled',
  MODULE_RESTARTED: 'system.module.restarted',
  MODULE_FAILED: 'system.module.failed',
  HEALTH_CHECK_PASSED: 'system.health.passed',
  HEALTH_CHECK_FAILED: 'system.health.failed',
  CAPABILITY_REGISTERED: 'system.capability.registered',
  CAPABILITY_UNREGISTERED: 'system.capability.unregistered',
} as const;

export type SystemEventName = (typeof SYSTEM_EVENTS)[keyof typeof SYSTEM_EVENTS];
