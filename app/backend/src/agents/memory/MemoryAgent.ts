import type { ILogger } from '@backend/logging/ILogger';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { MemoryManager } from '@backend/memory/MemoryManager';
import {
  fail,
  ok,
  requiredString,
  type ActionRequest,
  type ActionResult,
  type IActionAgent,
} from '@backend/agents/types';

/**
 * Exposes the Memory System as executable actions so that "remember my
 * birthday is in June" flows through exactly the same permission and
 * execution path as every other command.
 */
export class MemoryAgent implements IActionAgent {
  public readonly id = 'memory-agent';
  public readonly actions = ['memory.write', 'memory.read', 'memory.delete'] as const;

  constructor(
    private readonly logger: ILogger,
    private readonly memory: MemoryManager,
  ) {}

  async execute(request: ActionRequest): Promise<ActionResult> {
    if (!this.memory.isEnabled()) {
      return fail(request.action, 'Memory is currently switched off, so I cannot use it.');
    }

    switch (request.action) {
      case 'memory.write': {
        const value = requiredString(request.params, 'value');
        if (!value) return fail('memory.write', 'There was nothing for me to remember.');
        const key = requiredString(request.params, 'key') ?? value.slice(0, 40);
        const record = this.memory.remember('fact', key, value);
        this.logger.debug('Memory stored', { key });
        return ok('memory.write', `Noted. I will remember that ${key} is ${value}.`, record);
      }
      case 'memory.read': {
        const query = requiredString(request.params, 'query');
        const results = this.memory.search({ search: query ?? undefined, limit: 5 });
        if (results.length === 0) {
          return ok('memory.read', "I don't have anything stored about that yet.", { results });
        }
        const summary = results.map((record) => `${record.key}: ${record.value}`).join('; ');
        return ok('memory.read', `Here is what I remember — ${summary}.`, { results });
      }
      case 'memory.delete': {
        const id = requiredString(request.params, 'id');
        if (id) {
          const removed = this.memory.forget(id);
          return ok('memory.delete', removed ? 'That memory is deleted.' : 'I could not find that memory.', { removed });
        }
        const count = this.memory.forgetAll();
        return ok('memory.delete', `Cleared ${count} stored memories.`, { count });
      }
      default:
        return fail(request.action, `MemoryAgent cannot handle action "${request.action}"`);
    }
  }

  healthCheck(): ModuleStatus {
    return this.memory.healthCheck();
  }
}
