/** The categories the Event System must support. */
export const EVENT_CATEGORIES = [
  'system',
  'application',
  'plugin',
  'agent',
  'user',
  'internal',
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];
