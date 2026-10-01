import { describe, expect, it, vi } from 'vitest';

import { WakeWordManager } from '@backend/wake-word/WakeWordManager';
import { WakeWordProviderRegistry } from '@backend/wake-word/WakeWordProviderRegistry';
import { WakeWordProviderFactory } from '@backend/wake-word/WakeWordProviderFactory';
import { WakeWordProfile } from '@backend/wake-word/models/WakeWordProfile';
import {
  WakeWordError,
  WakeWordRegistryError,
  WakeWordProfileError,
} from '@backend/wake-word/errors/WakeWordError';
import type {
  IWakeWordProvider,
  ProviderWakeWordDetection,
} from '@backend/wake-word/interfaces/IWakeWordProvider';
import { createTestLogger } from '../support/testLogger';

function makeFakeProvider(id = 'fake-provider'): IWakeWordProvider & {
  trigger: (detection?: Partial<ProviderWakeWordDetection>) => void;
} {
  const handlers = new Set<(event: ProviderWakeWordDetection) => void>();
  return {
    id,
    name: 'Fake Wake Word Provider',
    initialize: vi.fn(),
    startListening: vi.fn(),
    stopListening: vi.fn(),
    onDetected: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    getCapabilities: () => ({
      supportsOffline: true,
      supportsCustomWakeWord: true,
      supportedWakeWords: ['Jarvis'],
      languages: ['en-US'],
    }),
    healthCheck: () => 'running',
    trigger: (detection = {}) => {
      handlers.forEach((h) => h({ timestamp: Date.now(), deviceId: null, ...detection }));
    },
  };
}

describe('WakeWordProfile', () => {
  it('defaults to the "Jarvis" wake word and standard secure-wake level', () => {
    const profile = new WakeWordProfile();
    expect(profile.wakeWordPhrase).toBe('Jarvis');
    expect(profile.secureWakeLevel).toBe('standard');
    expect(profile.enabled).toBe(true);
  });

  it('supports a custom wake word', () => {
    const profile = new WakeWordProfile({ wakeWordPhrase: 'Friday' });
    expect(profile.wakeWordPhrase).toBe('Friday');
  });

  it('rejects an out-of-range sensitivity or confidence threshold', () => {
    expect(() => new WakeWordProfile({ sensitivity: 1.5 })).toThrow(WakeWordProfileError);
    expect(() => new WakeWordProfile({ confidenceThreshold: -0.1 })).toThrow(WakeWordProfileError);
  });
});

describe('WakeWordProviderRegistry', () => {
  it('registers, queries, and unregisters a provider', () => {
    const registry = new WakeWordProviderRegistry(createTestLogger());
    const provider = makeFakeProvider();

    registry.register(provider);
    expect(registry.has('fake-provider')).toBe(true);
    expect(registry.list()).toHaveLength(1);

    registry.unregister('fake-provider');
    expect(registry.has('fake-provider')).toBe(false);
  });

  it('rejects duplicate registration and unknown unregistration', () => {
    const registry = new WakeWordProviderRegistry(createTestLogger());
    registry.register(makeFakeProvider());

    expect(() => registry.register(makeFakeProvider())).toThrow(WakeWordRegistryError);
    expect(() => registry.unregister('missing')).toThrow(WakeWordRegistryError);
  });
});

describe('WakeWordProviderFactory', () => {
  it('createProfile() returns a concrete WakeWordProfile', () => {
    const factory = new WakeWordProviderFactory();
    const profile = factory.createProfile({ wakeWordPhrase: 'Nova' });
    expect(profile).toBeInstanceOf(WakeWordProfile);
    expect(profile.wakeWordPhrase).toBe('Nova');
  });
});

describe('WakeWordManager — satisfies the Milestone 4.0 IWakeWordManager contract', () => {
  it('startListening()/stopListening() are safe no-ops with no active provider', () => {
    const registry = new WakeWordProviderRegistry(createTestLogger());
    const manager = new WakeWordManager(createTestLogger(), registry, new WakeWordProfile());

    expect(() => manager.startListening()).not.toThrow();
    expect(manager.getDetectionState()).toBe('listening');
    expect(() => manager.stopListening()).not.toThrow();
    expect(manager.getDetectionState()).toBe('idle');
  });

  it('reports "stopped" health with no active provider, and forwards the active provider health otherwise', async () => {
    const registry = new WakeWordProviderRegistry(createTestLogger());
    const manager = new WakeWordManager(createTestLogger(), registry, new WakeWordProfile());
    expect(await manager.healthCheck()).toBe('stopped');

    const provider = makeFakeProvider();
    manager.registerProvider(provider);
    manager.setActiveProvider(provider.id);
    expect(await manager.healthCheck()).toBe('running');
  });

  it('forwards a provider detection to onWakeWordDetected subscribers once listening', () => {
    const registry = new WakeWordProviderRegistry(createTestLogger());
    const manager = new WakeWordManager(createTestLogger(), registry, new WakeWordProfile());
    const provider = makeFakeProvider();
    manager.registerProvider(provider);
    manager.setActiveProvider(provider.id);
    manager.startListening();

    const handler = vi.fn();
    manager.onWakeWordDetected(handler);
    provider.trigger();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores detections below the confidence threshold', () => {
    const registry = new WakeWordProviderRegistry(createTestLogger());
    const profile = new WakeWordProfile({ confidenceThreshold: 0.8 });
    const manager = new WakeWordManager(createTestLogger(), registry, profile);
    const provider = makeFakeProvider();
    manager.registerProvider(provider);
    manager.setActiveProvider(provider.id);
    manager.startListening();

    const handler = vi.fn();
    manager.onWakeWordDetected(handler);
    provider.trigger({ confidence: 0.3 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores repeated detections within the cooldown window', () => {
    const registry = new WakeWordProviderRegistry(createTestLogger());
    const profile = new WakeWordProfile({ cooldownMs: 10_000 });
    const manager = new WakeWordManager(createTestLogger(), registry, profile);
    const provider = makeFakeProvider();
    manager.registerProvider(provider);
    manager.setActiveProvider(provider.id);
    manager.startListening();

    const handler = vi.fn();
    manager.onWakeWordDetected(handler);
    provider.trigger();
    provider.trigger();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not detect while disabled', () => {
    const registry = new WakeWordProviderRegistry(createTestLogger());
    const profile = new WakeWordProfile({ enabled: false });
    const manager = new WakeWordManager(createTestLogger(), registry, profile);
    manager.startListening();
    expect(manager.getDetectionState()).toBe('disabled');
  });

  it('setActiveProvider() throws for an unregistered provider id', () => {
    const registry = new WakeWordProviderRegistry(createTestLogger());
    const manager = new WakeWordManager(createTestLogger(), registry, new WakeWordProfile());
    expect(() => manager.setActiveProvider('missing')).toThrow(WakeWordError);
  });
});
