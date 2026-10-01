import type { ILogger } from '@backend/logging/ILogger';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { IHealthCheckable } from '@backend/shared/interfaces/IHealthCheckable';
import type { ActionRequest, ActionResult, IActionAgent } from '@backend/agents/types';
import { fail } from '@backend/agents/types';

/**
 * Routes an action id to the agent that declared it.
 *
 * Keeps the Action Executor free of any `if (agent === ...)` chains and
 * makes new capability agents a pure registration concern.
 */
export class ActionAgentRegistry implements IHealthCheckable {
  private readonly agents = new Map<string, IActionAgent>();
  private readonly routes = new Map<string, IActionAgent>();

  constructor(private readonly logger: ILogger) {}

  register(agent: IActionAgent): void {
    if (this.agents.has(agent.id)) {
      this.logger.warn(`Action agent already registered: ${agent.id}`);
      return;
    }
    this.agents.set(agent.id, agent);
    for (const action of agent.actions) {
      this.routes.set(action, agent);
    }
    this.logger.info(`Action agent registered: ${agent.id}`, { actions: agent.actions.length });
  }

  unregister(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    for (const action of agent.actions) {
      if (this.routes.get(action) === agent) this.routes.delete(action);
    }
    this.agents.delete(agentId);
  }

  resolve(action: string): IActionAgent | undefined {
    return this.routes.get(action);
  }

  listActions(): string[] {
    return [...this.routes.keys()].sort();
  }

  listAgents(): IActionAgent[] {
    return [...this.agents.values()];
  }

  async execute(request: ActionRequest): Promise<ActionResult> {
    const agent = this.resolve(request.action);
    if (!agent) {
      return fail(request.action, `No agent can handle the action "${request.action}".`);
    }
    return agent.execute(request);
  }

  healthCheck(): ModuleStatus {
    return this.agents.size > 0 ? 'running' : 'stopped';
  }
}
