import { describe, expect, it, vi } from 'vitest';

import { VoiceManager } from '@backend/voice-provider/VoiceManager';
import { VoiceProviderRegistry } from '@backend/voice-provider/VoiceProviderRegistry';
import { VoiceProviderFactory } from '@backend/voice-provider/VoiceProviderFactory';
import { VoiceProfile } from '@backend/voice-provider/models/VoiceProfile';
import {
  VoiceProviderError,
  VoiceProviderRegistryError,
  VoiceProfileError,
} from '@backend/voice-provider/errors/VoiceProviderError';
import type { IVoiceProvider } from '@backend/voice-provider/interfaces/IVoiceProvider';
import type { VoiceResponseReadyEvent } from '@backend/voice-runtime/interfaces/IVoiceManager';
import { createTestLogger } from '../support/testLogger';

function makeFakeProvider(id = 'fake-tts'): IVoiceProvider & {
  triggerComplete: (event: VoiceResponseReadyEvent) => void;
} {
  const handlers = new Set<(event: VoiceResponseReadyEvent) => void>();
  return {
    id,
    name: 'Fake TTS Provider',
    initialize: vi.fn(),
    startSynthesis: vi.fn(),
    cancelSynthesis: vi.fn(),
    onSynthesisComplete: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    getCapabilities: () => ({
      genders: ['female', 'male', 'neutral'],
      languages: ['en-US'],
      supportsSSML: true,
      deploymentMode: 'cloud',
    }),
    healthCheck: () => 'running',
    triggerComplete: (event) => handlers.forEach((h) => h(event)),
  };
}

describe('VoiceProfile', () => {
  it('defaults to a female, natural/calm/professional/friendly/clear voice', () => {
    const profile = new VoiceProfile();
    expect(profile.gender).toBe('female');
    expect(profile.styleTags).toEqual(
      expect.arrayContaining(['natural', 'calm', 'professional', 'friendly', 'clear']),
    );
    expect(profile.enabled).toBe(true);
  });

  it('is fully configurable — not hardcoded to one gender or provider', () => {
    const profile = new VoiceProfile({ gender: 'male', providerId: 'elevenlabs' });
    expect(profile.gender).toBe('male');
    expect(profile.providerId).toBe('elevenlabs');
  });

  it('rejects a profile with no style tags', () => {
    expect(() => new VoiceProfile({ styleTags: [] })).toThrow(VoiceProfileError);
  });

  it('provides default voice metadata', () => {
    const profile = new VoiceProfile();
    expect(profile.metadata.sampleRateHz).toBeGreaterThan(0);
    expect(profile.metadata.previewText.length).toBeGreaterThan(0);
  });
});

describe('VoiceProviderRegistry', () => {
  it('registers, queries, and unregisters a provider', () => {
    const registry = new VoiceProviderRegistry(createTestLogger());
    const provider = makeFakeProvider();
    registry.register(provider);
    expect(registry.has('fake-tts')).toBe(true);
    registry.unregister('fake-tts');
    expect(registry.has('fake-tts')).toBe(false);
  });

  it('rejects duplicate registration and unknown unregistration', () => {
    const registry = new VoiceProviderRegistry(createTestLogger());
    registry.register(makeFakeProvider());
    expect(() => registry.register(makeFakeProvider())).toThrow(VoiceProviderRegistryError);
    expect(() => registry.unregister('missing')).toThrow(VoiceProviderRegistryError);
  });
});

describe('VoiceProviderFactory', () => {
  it('createProfile() returns a concrete VoiceProfile', () => {
    const factory = new VoiceProviderFactory();
    const profile = factory.createProfile({ gender: 'neutral' });
    expect(profile).toBeInstanceOf(VoiceProfile);
    expect(profile.gender).toBe('neutral');
  });
});

describe('VoiceManager — satisfies the Milestone 4.0 IVoiceManager contract', () => {
  it('speak() is a safe no-op with no active provider (no fabricated response)', async () => {
    const registry = new VoiceProviderRegistry(createTestLogger());
    const manager = new VoiceManager(createTestLogger(), registry, new VoiceProfile());

    const handler = vi.fn();
    manager.onVoiceResponseReady(handler);
    await manager.speak('session-1', 'hello');

    expect(handler).not.toHaveBeenCalled();
  });

  it('reports "stopped" health with no active provider, and forwards provider health otherwise', async () => {
    const registry = new VoiceProviderRegistry(createTestLogger());
    const manager = new VoiceManager(createTestLogger(), registry, new VoiceProfile());
    expect(await manager.healthCheck()).toBe('stopped');

    const provider = makeFakeProvider();
    manager.registerProvider(provider);
    manager.setActiveProvider(provider.id);
    expect(await manager.healthCheck()).toBe('running');
  });

  it('forwards a provider synthesis-complete event to onVoiceResponseReady subscribers', () => {
    const registry = new VoiceProviderRegistry(createTestLogger());
    const manager = new VoiceManager(createTestLogger(), registry, new VoiceProfile());
    const provider = makeFakeProvider();
    manager.registerProvider(provider);
    manager.setActiveProvider(provider.id);

    const handler = vi.fn();
    manager.onVoiceResponseReady(handler);
    provider.triggerComplete({ sessionId: 'session-1', text: 'It is sunny today.' });

    expect(handler).toHaveBeenCalledWith({ sessionId: 'session-1', text: 'It is sunny today.' });
  });

  it('calls startSynthesis() on the active provider when speak() is invoked', async () => {
    const registry = new VoiceProviderRegistry(createTestLogger());
    const manager = new VoiceManager(createTestLogger(), registry, new VoiceProfile());
    const provider = makeFakeProvider();
    manager.registerProvider(provider);
    manager.setActiveProvider(provider.id);

    await manager.speak('session-1', 'hello jarvis');
    expect(provider.startSynthesis).toHaveBeenCalledWith('session-1', 'hello jarvis');
  });

  it('setActiveProvider() throws for an unregistered provider id', () => {
    const registry = new VoiceProviderRegistry(createTestLogger());
    const manager = new VoiceManager(createTestLogger(), registry, new VoiceProfile());
    expect(() => manager.setActiveProvider('missing')).toThrow(VoiceProviderError);
  });

  it('getDefaultProfile()/setDefaultProfile() manage the active voice profile', () => {
    const registry = new VoiceProviderRegistry(createTestLogger());
    const initial = new VoiceProfile({ gender: 'female' });
    const manager = new VoiceManager(createTestLogger(), registry, initial);
    expect(manager.getDefaultProfile()).toBe(initial);

    const replacement = new VoiceProfile({ gender: 'male' });
    manager.setDefaultProfile(replacement);
    expect(manager.getDefaultProfile()).toBe(replacement);
  });
});
