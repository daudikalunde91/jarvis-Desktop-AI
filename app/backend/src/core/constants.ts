/**
 * Project-wide constants.
 * No hardcoded environment-specific values belong here — only stable,
 * structural constants that describe the shape of the application.
 */

export const APP_METADATA = {
  name: 'JARVIS',
  description: 'Next-generation Desktop AI Assistant',
  version: '0.1.0',
} as const;

/**
 * Logical IPC channel namespaces. Real channel names live in ipc/channels.ts.
 *
 * `COMMUNICATION` is reserved for the future Communication Bus (see
 * app/communication). It is declared now, unused, so that channel naming
 * stays consistent once that module is implemented — no bus logic exists
 * yet and none should be added under this milestone.
 */
export const IPC_NAMESPACE = {
  SYSTEM: 'system',
  CONFIG: 'config',
  BRAIN: 'brain',
  COMMUNICATION: 'communication',
  AI: 'ai',
} as const;

/** Default runtime directory names, relative to the project root. */
export const RUNTIME_DIRECTORIES = {
  config: 'config',
  database: 'database',
  logs: 'logs',
  assets: 'assets',
} as const;

export const LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const DEFAULT_WINDOW_OPTIONS = {
  width: 1280,
  height: 800,
  minWidth: 960,
  minHeight: 600,
} as const;
