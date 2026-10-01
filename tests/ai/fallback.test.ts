import { describe, expect, it } from 'vitest';

import { ProviderRegistry } from '@backend/ai/ProviderRegistry';
import { ProviderHealthManager } from '@backend/ai/ProviderHealthManager';
import { ProviderRouter } from '@backend/ai/ProviderRouter';
import { FallbackManager } from '@backend/ai/FallbackManager';
import { UsageTracker } from '@backend/ai/UsageTracker';
import { AllProvidersFailedError, AuthenticationError, RateLimitError, TimeoutError } from '@backend/ai/errors';
import type { IAIProvider } from '@backend/ai/interfaces/IAIProvider';
import type { AICompletionRequest, AICompletionResponse } from '@backend/ai/types';

const logger = { error: () => {}, warn: () => {}, info: () => {}, debug: () => {}, log: () => {} };

function fakeProvider(
  id: string,
  behavior: (request: AICompletionRequest) => Promise<AICompletionResponse>,
): IAIProvider {
  return {
    id,
    name: id,
    capabilities: { vision: false, toolCalling: false, coding: false },
    isConfigured: () => true,
    complete: behavior,
  };
}

function okResponse(providerId: string, text: string): AICompletionResponse {
  return { providerId, model: 'test-model', text, toolCalls: [], latencyMs: 1 };
}

function buildStack(providers: IAIProvider[]) {
  const registry = new ProviderRegistry(logger);
  for (const provider of providers) registry.register(provider);
  const health = new ProviderHealthManager(logger);
  const router = new ProviderRouter(registry, health, {
    general: providers.map((p) => p.id),
    coding: providers.map((p) => p.id),
    multimodal: providers.map((p) => p.id),
    planning: providers.map((p) => p.id),
  });
  const usage = new UsageTracker(logger);
  const fallback = new FallbackManager(logger, registry, router, health, usage);
  return { registry, health, router, usage, fallback };
}

const baseRequest: AICompletionRequest = {
  sessionId: 's1',
  taskType: 'general',
  messages: [{ role: 'user', content: 'hello' }],
};

describe('FallbackManager', () => {
  it('returns the first provider success without trying others', async () => {
    let secondCalled = false;
    const openai = fakeProvider('openai', async () => okResponse('openai', 'hi from openai'));
    const gemini = fakeProvider('gemini', async () => {
      secondCalled = true;
      return okResponse('gemini', 'hi from gemini');
    });
    const { fallback } = buildStack([openai, gemini]);

    const response = await fallback.complete(baseRequest);
    expect(response.providerId).toBe('openai');
    expect(secondCalled).toBe(false);
  });

  it('falls back from OpenAI (429) to Gemini on success', async () => {
    const openai = fakeProvider('openai', async () => {
      throw new RateLimitError('openai', 1000);
    });
    const gemini = fakeProvider('gemini', async () => okResponse('gemini', 'hi from gemini'));
    const { fallback } = buildStack([openai, gemini]);

    const response = await fallback.complete(baseRequest);
    expect(response.providerId).toBe('gemini');
  });

  it('falls back from Gemini failure to Claude', async () => {
    const openai = fakeProvider('openai', async () => {
      throw new RateLimitError('openai');
    });
    const gemini = fakeProvider('gemini', async () => {
      throw new TimeoutError('gemini');
    });
    const claude = fakeProvider('claude', async () => okResponse('claude', 'hi from claude'));
    const { fallback } = buildStack([openai, gemini, claude]);

    const response = await fallback.complete(baseRequest);
    expect(response.providerId).toBe('claude');
  });

  it('throws AllProvidersFailedError when every provider fails', async () => {
    const openai = fakeProvider('openai', async () => {
      throw new RateLimitError('openai');
    });
    const gemini = fakeProvider('gemini', async () => {
      throw new TimeoutError('gemini');
    });
    const { fallback } = buildStack([openai, gemini]);

    await expect(fallback.complete(baseRequest)).rejects.toBeInstanceOf(AllProvidersFailedError);
  });

  it('marks a rate-limited provider unhealthy so the next call skips it directly', async () => {
    let openaiCalls = 0;
    const openai = fakeProvider('openai', async () => {
      openaiCalls += 1;
      throw new RateLimitError('openai', 60_000);
    });
    const gemini = fakeProvider('gemini', async () => okResponse('gemini', 'hi'));
    const { fallback } = buildStack([openai, gemini]);

    await fallback.complete(baseRequest);
    await fallback.complete(baseRequest);

    // Second call should have found openai already RATE_LIMITED and skipped
    // straight to gemini — router filters ineligible providers before any
    // network call is attempted.
    expect(openaiCalls).toBe(1);
  });

  it('marks an invalid API key as AuthenticationError and still fails over', async () => {
    const openai = fakeProvider('openai', async () => {
      throw new AuthenticationError('openai');
    });
    const gemini = fakeProvider('gemini', async () => okResponse('gemini', 'hi'));
    const { fallback } = buildStack([openai, gemini]);

    const response = await fallback.complete(baseRequest);
    expect(response.providerId).toBe('gemini');
  });

  it('excludes a provider disabled in configuration from every candidate list', async () => {
    const openai = fakeProvider('openai', async () => okResponse('openai', 'should not be reached'));
    const gemini = fakeProvider('gemini', async () => okResponse('gemini', 'used instead'));
    const { health, router } = buildStack([openai, gemini]);
    health.markDisabled('openai');

    const candidates = router.candidatesFor('general');
    expect(candidates).toEqual(['gemini']);
  });

  it('Feature E: a tool-carrying request skips providers without toolCalling capability', () => {
    const noTools: IAIProvider = {
      id: 'local',
      name: 'local',
      capabilities: { vision: false, toolCalling: false, coding: false },
      isConfigured: () => true,
      complete: async () => okResponse('local', 'n/a'),
    };
    const withTools: IAIProvider = {
      id: 'openai',
      name: 'openai',
      capabilities: { vision: false, toolCalling: true, coding: true },
      isConfigured: () => true,
      complete: async () => okResponse('openai', 'n/a'),
    };
    const { router } = buildStack([withTools, noTools]);

    expect(router.candidatesFor('general', false, true)).toEqual(['openai']);
    // Without a tools requirement, both stay eligible — unchanged existing behavior.
    expect(router.candidatesFor('general', false, false)).toEqual(['openai', 'local']);
  });

  it('Feature E: FallbackManager only sends tool-capability-filtered candidates when the request actually has tools', async () => {
    let toolLessCalled = false;
    const toolLess: IAIProvider = {
      id: 'toolless',
      name: 'toolless',
      capabilities: { vision: false, toolCalling: false, coding: false },
      isConfigured: () => true,
      complete: async () => {
        toolLessCalled = true;
        return okResponse('toolless', 'should not run');
      },
    };
    const toolCapable: IAIProvider = {
      id: 'capable',
      name: 'capable',
      capabilities: { vision: false, toolCalling: true, coding: true },
      isConfigured: () => true,
      complete: async () => okResponse('capable', 'ran'),
    };
    const { fallback } = buildStack([toolLess, toolCapable]);

    const response = await fallback.complete({
      ...baseRequest,
      tools: [
        {
          name: 'noop',
          description: 'does nothing',
          parameters: { type: 'object', properties: {} },
          minRole: 'user',
          requiresConfirmation: false,
        },
      ],
    });

    expect(response.providerId).toBe('capable');
    expect(toolLessCalled).toBe(false);
  });
});
