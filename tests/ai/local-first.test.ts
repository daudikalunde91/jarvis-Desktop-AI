import { describe, expect, it } from 'vitest';

import { ActionAgentRegistry } from '@backend/agents/ActionAgentRegistry';
import { SystemAgent } from '@backend/agents/system/SystemAgent';
import { ShellCommandRunner } from '@backend/agents/runtime/ShellCommandRunner';
import { ActionExecutor } from '@backend/brain/ActionExecutor';
import { BrainManager } from '@backend/brain/BrainManager';
import { RulesEngine } from '@backend/brain/RulesEngine';
import { TaskPlanner } from '@backend/brain/TaskPlanner';
import { MemoryManager } from '@backend/memory/MemoryManager';
import { PermissionManager } from '@backend/security/PermissionManager';
import type { CloudRequest, ICloudReasoner } from '@backend/brain/CloudReasoner';

const logger = { error: () => {}, warn: () => {}, info: () => {}, debug: () => {}, log: () => {} };

/** Spy standing in for AIOrchestrator — records whether/when it was called. */
class SpyCloudReasoner implements ICloudReasoner {
  public callCount = 0;
  isAvailable(): boolean {
    return true;
  }
  async complete(_request: CloudRequest): Promise<string> {
    this.callCount += 1;
    return 'cloud reply';
  }
}

function build() {
  const runner = new ShellCommandRunner({ simulate: true, platform: 'win32' });
  const registry = new ActionAgentRegistry(logger);
  const memory = new MemoryManager(logger);
  memory.initialize();
  registry.register(new SystemAgent(logger, runner));
  const permissions = new PermissionManager(logger, 'admin');
  const cloud = new SpyCloudReasoner();
  const brain = new BrainManager(
    logger,
    new RulesEngine(logger),
    new TaskPlanner(),
    new ActionExecutor(logger, registry, permissions),
    memory,
    cloud,
  );
  return { brain, cloud };
}

describe('Local-first decision layer (M5)', () => {
  it('answers "saa ngapi?" (what time is it) without calling the AI orchestrator', async () => {
    const { brain, cloud } = build();
    const res = await brain.handle({ sessionId: 's1', utterance: 'saa ngapi?' });
    expect(res.intent.name).toBe('time_query');
    expect(cloud.callCount).toBe(0);
  });

  it('answers "what time is it" without calling the AI orchestrator', async () => {
    const { brain, cloud } = build();
    await brain.handle({ sessionId: 's1', utterance: 'what time is it' });
    expect(cloud.callCount).toBe(0);
  });

  it('answers a system-info request locally without calling the AI orchestrator', async () => {
    const { brain, cloud } = build();
    const res = await brain.handle({ sessionId: 's1', utterance: 'system status' });
    expect(res.intent.name).toBe('system_info');
    expect(cloud.callCount).toBe(0);
  });
});
