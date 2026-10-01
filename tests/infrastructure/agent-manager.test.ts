import { describe, expect, it, vi } from 'vitest';

import { AgentManager } from '@backend/infrastructure/agent-manager/AgentManager';
import { AgentManagerError } from '@backend/shared/errors/InfrastructureError';
import type { IAgentDescriptor } from '@backend/shared/interfaces/IAgentDescriptor';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import { createTestLogger } from '../support/testLogger';

function makeAgent(id: string, name = id): IAgentDescriptor {
  return {
    id,
    name,
    load: vi.fn(),
    unload: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    healthCheck: (): ModuleStatus => 'running',
  };
}

describe('AgentManager', () => {
  it('loads an agent and reports it running', async () => {
    const manager = new AgentManager(createTestLogger());
    const agent = makeAgent('agent-a');

    await manager.loadAgent(agent);

    expect(manager.getStatus('agent-a')).toBe('running');
    expect(agent.load).toHaveBeenCalledTimes(1);
  });

  it('rejects loading the same agent id twice', async () => {
    const manager = new AgentManager(createTestLogger());
    await manager.loadAgent(makeAgent('dup'));

    await expect(manager.loadAgent(makeAgent('dup'))).rejects.toBeInstanceOf(AgentManagerError);
  });

  it('validates that declared dependencies are loaded and running before loading', async () => {
    const manager = new AgentManager(createTestLogger());

    await expect(
      manager.loadAgent(makeAgent('dependent'), { dependencies: ['missing-dep'] }),
    ).rejects.toBeInstanceOf(AgentManagerError);

    await manager.loadAgent(makeAgent('base'));
    await manager.loadAgent(makeAgent('dependent'), { dependencies: ['base'] });
    expect(manager.getStatus('dependent')).toBe('running');
  });

  it('refuses to unload an agent that other loaded agents depend on', async () => {
    const manager = new AgentManager(createTestLogger());
    await manager.loadAgent(makeAgent('base'));
    await manager.loadAgent(makeAgent('dependent'), { dependencies: ['base'] });

    await expect(manager.unloadAgent('base')).rejects.toBeInstanceOf(AgentManagerError);

    await manager.unloadAgent('dependent');
    await manager.unloadAgent('base');
    expect(manager.list()).toHaveLength(0);
  });

  it('enable/disable/restart drive the agent lifecycle hooks', async () => {
    const manager = new AgentManager(createTestLogger());
    const agent = makeAgent('lifecycle-agent');
    await manager.loadAgent(agent);

    await manager.disableAgent('lifecycle-agent');
    expect(manager.getStatus('lifecycle-agent')).toBe('stopped');
    expect(agent.disable).toHaveBeenCalledTimes(1);

    await manager.enableAgent('lifecycle-agent');
    expect(manager.getStatus('lifecycle-agent')).toBe('running');
    expect(agent.enable).toHaveBeenCalledTimes(1);

    await manager.restartAgent('lifecycle-agent');
    expect(manager.getStatus('lifecycle-agent')).toBe('running');
    expect(agent.disable).toHaveBeenCalledTimes(2);
    expect(agent.enable).toHaveBeenCalledTimes(2);
  });

  it('registers loaded agents with the Health Monitor when one is provided', async () => {
    const registerSpy = vi.fn();
    const healthMonitor = {
      register: registerSpy,
      unregister: vi.fn(),
      heartbeat: vi.fn(),
      getStatus: vi.fn(),
      getRecord: vi.fn(),
      getAll: vi.fn(),
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      checkNow: vi.fn(),
    };

    const manager = new AgentManager(createTestLogger(), healthMonitor);
    await manager.loadAgent(makeAgent('monitored'));

    expect(registerSpy).toHaveBeenCalledWith('monitored', expect.any(Function), expect.any(Object));
  });
});
