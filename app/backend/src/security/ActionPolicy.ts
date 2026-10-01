import type { ActionPolicy } from '@backend/security/types/SecurityTypes';
import { INTEGRATION_ACTION_POLICIES } from '@backend/integrations/capabilities';

/**
 * The single classification table for every executable action JARVIS
 * exposes. Agents never decide their own risk level — they declare an
 * action id and the Permission Manager looks the policy up here.
 */
export const DEFAULT_ACTION_POLICIES: readonly ActionPolicy[] = [
  // ---- Conversation / read-only ----
  { action: 'assistant.reply', risk: 'low', minimumRole: 'guest', description: 'Speak a reply' },
  {
    action: 'system.info',
    risk: 'low',
    minimumRole: 'guest',
    description: 'Read CPU / RAM / OS information',
  },
  {
    action: 'system.time',
    risk: 'low',
    minimumRole: 'guest',
    description: 'Read the system clock',
  },

  // ---- Applications ----
  { action: 'app.discover', risk: 'low', minimumRole: 'user', description: 'Discover installed applications' },
  { action: 'app.open', risk: 'low', minimumRole: 'user', description: 'Open an application' },
  { action: 'app.close', risk: 'medium', minimumRole: 'user', description: 'Close an application' },

  // ---- System control ----
  { action: 'system.lock', risk: 'medium', minimumRole: 'user', description: 'Lock the computer' },
  { action: 'system.sleep', risk: 'medium', minimumRole: 'user', description: 'Sleep the computer' },
  {
    action: 'system.restart',
    risk: 'high',
    minimumRole: 'admin',
    description: 'Restart the computer',
  },
  {
    action: 'system.shutdown',
    risk: 'high',
    minimumRole: 'admin',
    description: 'Shut down the computer',
  },

  // ---- Files ----
  { action: 'file.list', risk: 'low', minimumRole: 'user', description: 'List a directory' },
  { action: 'file.search', risk: 'low', minimumRole: 'user', description: 'Search for files' },
  { action: 'file.read', risk: 'medium', minimumRole: 'user', description: 'Read a file' },
  {
    action: 'file.createFolder',
    risk: 'medium',
    minimumRole: 'user',
    description: 'Create a folder',
  },
  { action: 'file.create', risk: 'medium', minimumRole: 'user', description: 'Create a file' },
  { action: 'file.rename', risk: 'medium', minimumRole: 'user', description: 'Rename an entry' },
  { action: 'file.move', risk: 'medium', minimumRole: 'user', description: 'Move an entry' },
  { action: 'file.copy', risk: 'medium', minimumRole: 'user', description: 'Copy an entry' },
  { action: 'file.open', risk: 'medium', minimumRole: 'user', description: 'Open a file' },
  {
    action: 'file.delete',
    risk: 'sensitive',
    minimumRole: 'admin',
    description: 'Delete a file or folder',
  },

  // ---- Browser ----
  { action: 'browser.open', risk: 'low', minimumRole: 'user', description: 'Open a URL' },
  { action: 'browser.search', risk: 'low', minimumRole: 'user', description: 'Search the web' },

  // ---- Coding assistant ----
  {
    action: 'coding.inspectProject',
    risk: 'low',
    minimumRole: 'user',
    description: 'Inspect a project tree',
  },
  {
    action: 'coding.readFile',
    risk: 'medium',
    minimumRole: 'user',
    description: 'Read a source file',
  },
  {
    action: 'coding.writeFile',
    risk: 'sensitive',
    minimumRole: 'admin',
    description: 'Modify a source file',
  },
  {
    action: 'coding.runCommand',
    risk: 'sensitive',
    minimumRole: 'admin',
    description: 'Run a terminal command',
  },

  // ---- Memory ----
  { action: 'memory.read', risk: 'low', minimumRole: 'user', description: 'Read stored memory' },
  { action: 'memory.write', risk: 'low', minimumRole: 'user', description: 'Store a memory' },
  {
    action: 'memory.delete',
    risk: 'medium',
    minimumRole: 'user',
    description: 'Delete stored memory',
  },

  // ---- Vision ----
  {
    action: 'vision.capture',
    risk: 'sensitive',
    minimumRole: 'user',
    description: 'Use the camera',
  },

  // ---- Personal integrations (Stage 7) — see integrations/capabilities.ts ----
  ...INTEGRATION_ACTION_POLICIES,
];

/** Policy applied to any action id that is not classified above. */
export const UNKNOWN_ACTION_POLICY: ActionPolicy = {
  action: '*',
  risk: 'sensitive',
  minimumRole: 'admin',
  description: 'Unclassified action — treated as sensitive by default (deny-by-default)',
};

const POLICY_INDEX: ReadonlyMap<string, ActionPolicy> = new Map(
  DEFAULT_ACTION_POLICIES.map((policy) => [policy.action, policy]),
);

/** Looks up a policy by action id. Returns undefined for unclassified ids. */
export function getActionPolicy(action: string): ActionPolicy | undefined {
  return POLICY_INDEX.get(action);
}

/** Deny-by-default resolution: unclassified actions become `sensitive`/`admin`. */
export function resolveActionPolicy(action: string): ActionPolicy {
  return POLICY_INDEX.get(action) ?? { ...UNKNOWN_ACTION_POLICY, action };
}
