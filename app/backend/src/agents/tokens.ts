import { InjectionToken } from '@backend/shared/types/Token';
import type { ActionAgentRegistry } from '@backend/agents/ActionAgentRegistry';
import type { ICommandRunner } from '@backend/agents/runtime/ShellCommandRunner';

/** DI Container tokens for the capability-agent layer. */
export const AGENT_TOKENS = {
  CommandRunner: new InjectionToken<ICommandRunner>('CommandRunner'),
  ActionAgentRegistry: new InjectionToken<ActionAgentRegistry>('ActionAgentRegistry'),
} as const;
