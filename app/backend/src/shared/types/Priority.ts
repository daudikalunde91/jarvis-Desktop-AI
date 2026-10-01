/**
 * Shared priority scale used by the Communication Bus, Event System, and
 * Capability Registry. Kept as a single source of truth so ordering
 * semantics (higher = more urgent) never drift between subsystems.
 */
export const PRIORITY_LEVELS = ['low', 'normal', 'high', 'critical'] as const;
export type Priority = (typeof PRIORITY_LEVELS)[number];

const PRIORITY_WEIGHT: Record<Priority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

/** Higher number = should be processed first. */
export function priorityWeight(priority: Priority): number {
  return PRIORITY_WEIGHT[priority];
}
