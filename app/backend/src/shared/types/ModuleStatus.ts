/**
 * Lifecycle status shared by anything the Health Monitor or Agent
 * Manager tracks (agents, capabilities, infrastructure services).
 */
export const MODULE_STATUSES = ['stopped', 'starting', 'running', 'restarting', 'failed'] as const;
export type ModuleStatus = (typeof MODULE_STATUSES)[number];
