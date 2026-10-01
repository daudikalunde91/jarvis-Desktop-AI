import { describe, expect, it } from 'vitest';

import { CapabilityRegistry } from '@backend/infrastructure/capability-registry/CapabilityRegistry';
import { CapabilityRegistryError } from '@backend/shared/errors/InfrastructureError';
import type { ICapability } from '@backend/shared/interfaces/ICapability';
import { createTestLogger } from '../support/testLogger';

function makeCapability(overrides: Partial<ICapability> = {}): ICapability {
  return {
    name: 'weather-lookup',
    version: '1.0.0',
    description: 'Looks up current weather conditions.',
    owner: 'core-team',
    permissionsRequired: ['network'],
    priority: 'normal',
    offlineSupport: false,
    status: 'stopped',
    dependencies: [],
    estimatedExecutionTimeMs: 500,
    category: 'utility',
    ...overrides,
  };
}

describe('CapabilityRegistry', () => {
  it('registers and queries a capability', () => {
    const registry = new CapabilityRegistry(createTestLogger());
    registry.register(makeCapability());

    expect(registry.has('weather-lookup')).toBe(true);
    expect(registry.query('weather-lookup')?.owner).toBe('core-team');
  });

  it('rejects duplicate registration by name', () => {
    const registry = new CapabilityRegistry(createTestLogger());
    registry.register(makeCapability());

    expect(() => registry.register(makeCapability())).toThrow(CapabilityRegistryError);
  });

  it('discovers capabilities by category', () => {
    const registry = new CapabilityRegistry(createTestLogger());
    registry.register(makeCapability({ name: 'a', category: 'utility' }));
    registry.register(makeCapability({ name: 'b', category: 'reasoning' }));

    const utilities = registry.discover({ category: 'utility' });
    expect(utilities.map((c) => c.name)).toEqual(['a']);
  });

  it('unregister() removes a capability, but refuses if something depends on it', () => {
    const registry = new CapabilityRegistry(createTestLogger());
    registry.register(makeCapability({ name: 'base' }));
    registry.register(makeCapability({ name: 'dependent', dependencies: ['base'] }));

    expect(() => registry.unregister('base')).toThrow(CapabilityRegistryError);

    registry.unregister('dependent');
    registry.unregister('base');
    expect(registry.has('base')).toBe(false);
  });

  it('updateStatus() and getHealthStatus() reflect the latest status', () => {
    const registry = new CapabilityRegistry(createTestLogger());
    registry.register(makeCapability({ name: 'x' }));

    registry.updateStatus('x', 'running');
    expect(registry.getHealthStatus('x')).toBe('running');
  });
});
