import { describe, expect, it, vi } from 'vitest';

import { SpeechManager } from '@backend/speech-to-text/SpeechManager';
import { SpeechProviderRegistry } from '@backend/speech-to-text/SpeechProviderRegistry';
import { SpeechProviderFactory } from '@backend/speech-to-text/SpeechProviderFactory';
import { SpeechSession } from '@backend/speech-to-text/models/SpeechSession';
import { SpeechError, SpeechRegistryError } from '@backend/speech-to-text/errors/SpeechError';
import { FIRST_CLASS_LANGUAGES } from '@backend/speech-to-text/types/SupportedLanguage';
import type { ISpeechProvider } from '@backend/speech-to-text/interfaces/ISpeechProvider';
import type { SpeechResult } from '@backend/speech-to-text/models/SpeechResult';
import { createTestLogger } from '../support/testLogger';

function makeFakeProvider(id = 'fake-stt') {
  const partialHandlers = new Set<(result: SpeechResult) => void>();
  const finalHandlers = new Set<(result: SpeechResult) => void>();
  const provider: ISpeechProvider & {
    triggerPartial: (result: SpeechResult) => void;
    triggerFinal: (result: SpeechResult) => void;
  } = {
    id,
    name: 'Fake STT Provider',
    initialize: vi.fn(),
    startStreaming: vi.fn(),
    stopStreaming: vi.fn(),
    onPartialResult: (handler) => {
      partialHandlers.add(handler);
      return () => partialHandlers.delete(handler);
    },
    onFinalResult: (handler) => {
      finalHandlers.add(handler);
      return () => finalHandlers.delete(handler);
    },
    getCapabilities: () => ({
      languages: ['en-US', 'sw-KE'],
      supportsStreaming: true,
      supportsOffline: false,
      supportsAutoLanguageDetection: true,
    }),
    healthCheck: () => 'running',
    triggerPartial: (result) => partialHandlers.forEach((h) => h(result)),
    triggerFinal: (result) => finalHandlers.forEach((h) => h(result)),
  };
  return provider;
}

function makeResult(overrides: Partial<SpeechResult> = {}): SpeechResult {
  return {
    sessionId: 'session-1',
    text: 'hello',
    confidence: 0.9,
    isFinal: false,
    language: 'en-US',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('Supported languages', () => {
  it('treats English and Swahili as first-class languages', () => {
    expect(FIRST_CLASS_LANGUAGES).toContain('en-US');
    expect(FIRST_CLASS_LANGUAGES).toContain('sw-KE');
  });
});

describe('SpeechProviderRegistry', () => {
  it('registers, queries, and unregisters a provider', () => {
    const registry = new SpeechProviderRegistry(createTestLogger());
    const provider = makeFakeProvider();
    registry.register(provider);
    expect(registry.has('fake-stt')).toBe(true);
    registry.unregister('fake-stt');
    expect(registry.has('fake-stt')).toBe(false);
  });

  it('rejects duplicate registration and unknown unregistration', () => {
    const registry = new SpeechProviderRegistry(createTestLogger());
    registry.register(makeFakeProvider());
    expect(() => registry.register(makeFakeProvider())).toThrow(SpeechRegistryError);
    expect(() => registry.unregister('missing')).toThrow(SpeechRegistryError);
  });
});

describe('SpeechProviderFactory', () => {
  it('createSession() returns a concrete SpeechSession', () => {
    const factory = new SpeechProviderFactory();
    const session = factory.createSession({ runtimeSessionId: 'rt-1', language: 'sw-KE' });
    expect(session).toBeInstanceOf(SpeechSession);
    expect(session.language).toBe('sw-KE');
  });

  it('createResult() builds a well-formed SpeechResult', () => {
    const factory = new SpeechProviderFactory();
    const result = factory.createResult({ sessionId: 's1', text: 'habari', isFinal: true });
    expect(result.text).toBe('habari');
    expect(result.isFinal).toBe(true);
    expect(result.confidence).toBeNull();
  });
});

describe('SpeechManager — satisfies the Milestone 4.0 ISpeechManager contract', () => {
  it('startRecognition() tracks a session even with no active provider', () => {
    const registry = new SpeechProviderRegistry(createTestLogger());
    const factory = new SpeechProviderFactory();
    const manager = new SpeechManager(createTestLogger(), registry, factory, {
      defaultLanguage: 'en-US',
      autoDetectLanguage: false,
    });

    expect(() => manager.startRecognition('session-1')).not.toThrow();
    expect(manager.getSession('session-1')?.status).toBe('listening');
  });

  it('reports "stopped" health with no active provider, and forwards provider health otherwise', async () => {
    const registry = new SpeechProviderRegistry(createTestLogger());
    const factory = new SpeechProviderFactory();
    const manager = new SpeechManager(createTestLogger(), registry, factory, {
      defaultLanguage: 'en-US',
      autoDetectLanguage: false,
    });
    expect(await manager.healthCheck()).toBe('stopped');

    const provider = makeFakeProvider();
    manager.registerProvider(provider);
    manager.setActiveProvider(provider.id);
    expect(await manager.healthCheck()).toBe('running');
  });

  it('fires onSpeechStarted on the first partial result and onSpeechRecognized + onSpeechFinished on the final result', () => {
    const registry = new SpeechProviderRegistry(createTestLogger());
    const factory = new SpeechProviderFactory();
    const manager = new SpeechManager(createTestLogger(), registry, factory, {
      defaultLanguage: 'en-US',
      autoDetectLanguage: false,
    });
    const provider = makeFakeProvider();
    manager.registerProvider(provider);
    manager.setActiveProvider(provider.id);
    manager.startRecognition('session-1');

    const started = vi.fn();
    const finished = vi.fn();
    const recognized = vi.fn();
    manager.onSpeechStarted(started);
    manager.onSpeechFinished(finished);
    manager.onSpeechRecognized(recognized);

    provider.triggerPartial(makeResult({ isFinal: false }));
    expect(started).toHaveBeenCalledWith('session-1');

    provider.triggerFinal(makeResult({ isFinal: true, text: 'hello jarvis' }));
    expect(recognized).toHaveBeenCalledWith({
      sessionId: 'session-1',
      text: 'hello jarvis',
      confidence: 0.9,
    });
    expect(finished).toHaveBeenCalledWith('session-1');
  });

  it('setActiveProvider() throws for an unregistered provider id', () => {
    const registry = new SpeechProviderRegistry(createTestLogger());
    const factory = new SpeechProviderFactory();
    const manager = new SpeechManager(createTestLogger(), registry, factory, {
      defaultLanguage: 'en-US',
      autoDetectLanguage: false,
    });
    expect(() => manager.setActiveProvider('missing')).toThrow(SpeechError);
  });
});
