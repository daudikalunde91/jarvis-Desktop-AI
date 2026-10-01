import type { ActionPolicy } from '@backend/security/types/SecurityTypes';

/** Capability-based permissions. A grant is per capability, never "all". */
export const INTEGRATION_CAPABILITIES = [
  'gmail.read',
  'gmail.send',
  'calendar.read',
  'calendar.create',
  'calendar.update',
  'calendar.delete',
  'drive.read',
  'drive.write',
  'whatsapp.send',
  'outlook.read',
  'outlook.send',
  'onedrive.read',
  'onedrive.write',
] as const;
export type IntegrationCapability = (typeof INTEGRATION_CAPABILITIES)[number];

export function isIntegrationCapability(value: unknown): value is IntegrationCapability {
  return typeof value === 'string' && (INTEGRATION_CAPABILITIES as readonly string[]).includes(value);
}

/**
 * Policies merged into the existing PermissionManager table (see ActionPolicy.ts).
 * Reads are `low` (no prompt; the capability grant is the gate). Anything that
 * communicates externally or changes/deletes data requires confirmation.
 */
export const INTEGRATION_ACTION_POLICIES: readonly ActionPolicy[] = [
  { action: 'gmail.search', risk: 'low', minimumRole: 'user', description: 'Search Gmail messages' },
  { action: 'gmail.read', risk: 'low', minimumRole: 'user', description: 'Read a Gmail message' },
  { action: 'gmail.send', risk: 'sensitive', minimumRole: 'user', description: 'Send an email via Gmail' },
  { action: 'calendar.list_events', risk: 'low', minimumRole: 'user', description: 'List calendar events' },
  { action: 'calendar.search_events', risk: 'low', minimumRole: 'user', description: 'Search calendar events' },
  { action: 'calendar.create_event', risk: 'medium', minimumRole: 'user', description: 'Create a calendar event' },
  { action: 'calendar.update_event', risk: 'medium', minimumRole: 'user', description: 'Update a calendar event' },
  { action: 'calendar.delete_event', risk: 'high', minimumRole: 'user', description: 'Delete a calendar event' },
];
