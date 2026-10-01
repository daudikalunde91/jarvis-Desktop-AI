import { describe, expect, it } from 'vitest';

import { ActionAgentRegistry } from '@backend/agents/ActionAgentRegistry';
import { BrowserAgent } from '@backend/agents/browser/BrowserAgent';
import { MemoryAgent } from '@backend/agents/memory/MemoryAgent';
import { ShellCommandRunner } from '@backend/agents/runtime/ShellCommandRunner';
import { SystemAgent } from '@backend/agents/system/SystemAgent';
import { ActionExecutor } from '@backend/brain/ActionExecutor';
import { BrainManager } from '@backend/brain/BrainManager';
import { RulesEngine } from '@backend/brain/RulesEngine';
import { TaskPlanner } from '@backend/brain/TaskPlanner';
import { MemoryManager } from '@backend/memory/MemoryManager';
import { PermissionManager } from '@backend/security/PermissionManager';

const logger = {
  error: () => {}, warn: () => {}, info: () => {}, debug: () => {}, log: () => {},
};

function build(role: 'guest' | 'user' | 'admin' = 'admin') {
  const runner = new ShellCommandRunner({ simulate: true, platform: 'win32' });
  const registry = new ActionAgentRegistry(logger);
  const memory = new MemoryManager(logger);
  memory.initialize();
  registry.register(new SystemAgent(logger, runner));
  registry.register(new BrowserAgent(logger, runner));
  registry.register(new MemoryAgent(logger, memory));
  const permissions = new PermissionManager(logger, role);
  const brain = new BrainManager(
    logger, new RulesEngine(logger), new TaskPlanner(),
    new ActionExecutor(logger, registry, permissions), memory,
  );
  return { brain, memory, permissions };
}

describe('Brain pipeline', () => {
  it('answers a greeting offline without any action', async () => {
    const { brain } = build();
    const res = await brain.handle({ sessionId: 's1', utterance: 'hello' });
    expect(res.intent.name).toBe('greeting');
    expect(res.source).toBe('rules');
    expect(res.execution).toBeNull();
  });

  it('understands Swahili', async () => {
    const { brain } = build();
    const res = await brain.handle({ sessionId: 's1', utterance: 'habari yako' });
    expect(res.intent.language).toBe('sw');
    expect(res.reply).toContain('JARVIS');
  });

  it('runs a low-risk action immediately', async () => {
    const { brain } = build();
    const res = await brain.handle({ sessionId: 's1', utterance: 'what time is it' });
    expect(res.execution?.completed).toBe(true);
  });

  it('asks for confirmation before shutting down, then obeys "yes"', async () => {
    const { brain } = build('admin');
    const first = await brain.handle({ sessionId: 's2', utterance: 'shutdown the computer' });
    expect(first.execution?.pendingConfirmation).not.toBeNull();
    expect(brain.hasPendingConfirmation('s2')).toBe(true);

    const second = await brain.handle({ sessionId: 's2', utterance: 'yes' });
    expect(second.execution?.completed).toBe(true);
    expect(brain.hasPendingConfirmation('s2')).toBe(false);
  });

  it('denies a high-risk action for a non-admin role', async () => {
    const { brain } = build('user');
    const res = await brain.handle({ sessionId: 's3', utterance: 'restart the computer', confirmed: true });
    expect(res.execution?.outcomes[0]?.status).toBe('denied');
  });

  it('remembers and recalls a fact', async () => {
    const { brain } = build();
    await brain.handle({ sessionId: 's4', utterance: 'remember my editor is vscode', confirmed: true });
    const res = await brain.handle({ sessionId: 's4', utterance: 'what do you remember about editor' });
    expect(res.reply.toLowerCase()).toContain('vscode');
  });
});
