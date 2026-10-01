import { afterEach, describe, expect, it, vi } from 'vitest';

import { AIOrchestrator } from '@backend/ai/AIOrchestrator';
import { ProviderRegistry } from '@backend/ai/ProviderRegistry';
import { ProviderHealthManager } from '@backend/ai/ProviderHealthManager';
import { ProviderRouter } from '@backend/ai/ProviderRouter';
import { FallbackManager } from '@backend/ai/FallbackManager';
import { UsageTracker } from '@backend/ai/UsageTracker';
import { OpenAIProvider } from '@backend/ai/providers/OpenAIProvider';
import { GeminiProvider } from '@backend/ai/providers/GeminiProvider';
import { AllProvidersFailedError } from '@backend/ai/errors';
import type { CloudRequest } from '@backend/brain/CloudReasoner';

const SECRET_OPENAI_KEY = 'sk-super-secret-openai-key';
const SECRET_GEMINI_KEY = 'AIza-super-secret-gemini-key';

function buildLoggerSpy() {
  const calls: string[] = [];
  const record = (...args: unknown[]) => calls.push(args.map((a) => JSON.stringify(a)).join(' '));
  return {
    calls,
    logger: { error: record, warn: record, info: record, debug: record, log: record },
  };
}

describe('AIOrchestrator (M5.1 integration)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('never fabricates a response and throws when every configured provider fails', async () => {
    const { logger } = buildLoggerSpy();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('rate limited', { status: 429 })),
    );

    const registry = new ProviderRegistry(logger);
    const openai = new OpenAIProvider(logger, { apiKey: SECRET_OPENAI_KEY, model: 'gpt-4.1-mini' });
    registry.register(openai);
    const health = new ProviderHealthManager(logger);
    const router = new ProviderRouter(registry, health, {
      general: ['openai'],
      coding: ['openai'],
      multimodal: ['openai'],
      planning: ['openai'],
    });
    const usage = new UsageTracker(logger);
    const fallback = new FallbackManager(logger, registry, router, health, usage);
    const orchestrator = new AIOrchestrator(logger, registry, health, fallback, usage);

    const request: CloudRequest = { messages: [{ role: 'user', content: 'hello' }] };
    await expect(orchestrator.complete(request)).rejects.toBeInstanceOf(AllProvidersFailedError);
  });

  it('never writes a provider API key into any log line, even on failure', async () => {
    const { logger, calls } = buildLoggerSpy();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('unauthorized', { status: 401 })),
    );

    const registry = new ProviderRegistry(logger);
    const openai = new OpenAIProvider(logger, { apiKey: SECRET_OPENAI_KEY, model: 'gpt-4.1-mini' });
    const gemini = new GeminiProvider(logger, { apiKey: SECRET_GEMINI_KEY, model: 'gemini-2.5-flash' });
    registry.register(openai);
    registry.register(gemini);
    const health = new ProviderHealthManager(logger);
    const router = new ProviderRouter(registry, health, {
      general: ['openai', 'gemini'],
      coding: ['openai', 'gemini'],
      multimodal: ['openai', 'gemini'],
      planning: ['openai', 'gemini'],
    });
    const usage = new UsageTracker(logger);
    const fallback = new FallbackManager(logger, registry, router, health, usage);
    const orchestrator = new AIOrchestrator(logger, registry, health, fallback, usage);

    const request: CloudRequest = { messages: [{ role: 'user', content: 'hello' }] };
    await expect(orchestrator.complete(request)).rejects.toBeInstanceOf(AllProvidersFailedError);

    const joined = calls.join('\n');
    expect(joined).not.toContain(SECRET_OPENAI_KEY);
    expect(joined).not.toContain(SECRET_GEMINI_KEY);
  });

  it('reports itself unavailable when no provider is configured', () => {
    const { logger } = buildLoggerSpy();
    const registry = new ProviderRegistry(logger);
    registry.register(new OpenAIProvider(logger, { apiKey: '', model: '' }));
    const health = new ProviderHealthManager(logger);
    const router = new ProviderRouter(registry, health, {
      general: ['openai'],
      coding: ['openai'],
      multimodal: ['openai'],
      planning: ['openai'],
    });
    const usage = new UsageTracker(logger);
    const fallback = new FallbackManager(logger, registry, router, health, usage);
    const orchestrator = new AIOrchestrator(logger, registry, health, fallback, usage);

    expect(orchestrator.isAvailable()).toBe(false);
  });
});
