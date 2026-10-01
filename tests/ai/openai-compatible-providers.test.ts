import { afterEach, describe, expect, it, vi } from 'vitest';

import { GroqProvider } from '@backend/ai/providers/GroqProvider';
import { OpenRouterProvider } from '@backend/ai/providers/OpenRouterProvider';
import { LovableProvider } from '@backend/ai/providers/LovableProvider';
import { AuthenticationError, QuotaExceededError, RateLimitError } from '@backend/ai/errors';
import type { AICompletionRequest } from '@backend/ai/types';

const logger = { error: () => {}, warn: () => {}, info: () => {}, debug: () => {}, log: () => {} };
const SECRET_KEY = 'sk-test-super-secret-value-should-never-appear';

const baseRequest: AICompletionRequest = {
  sessionId: 's1',
  taskType: 'general',
  messages: [{ role: 'user', content: 'hello' }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenAICompatibleProvider (Groq / OpenRouter / Lovable)', () => {
  it('Groq: parses a normal chat completion, including usage', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            choices: [{ message: { content: 'hi there' } }],
            usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const groq = new GroqProvider(logger, { apiKey: SECRET_KEY, model: 'llama-3.3-70b-versatile' });
    expect(groq.isConfigured()).toBe(true);
    const response = await groq.complete(baseRequest);

    expect(response.text).toBe('hi there');
    expect(response.usage).toEqual({ promptTokens: 5, completionTokens: 3, totalTokens: 8 });
    expect(response.providerId).toBe('groq');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${SECRET_KEY}`);
  });

  it('Groq: a 429 with insufficient_quota body throws QuotaExceededError, not RateLimitError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { type: 'insufficient_quota', message: 'out of credits' } }), {
            status: 429,
          }),
      ),
    );
    const groq = new GroqProvider(logger, { apiKey: SECRET_KEY, model: 'llama-3.3-70b-versatile' });
    await expect(groq.complete(baseRequest)).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('Groq: a plain 429 (no quota phrase) still throws RateLimitError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('rate limited', { status: 429 })));
    const groq = new GroqProvider(logger, { apiKey: SECRET_KEY, model: 'llama-3.3-70b-versatile' });
    await expect(groq.complete(baseRequest)).rejects.toBeInstanceOf(RateLimitError);
  });

  it('Groq: never leaks the API key into a thrown error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unauthorized', { status: 401 })));
    const groq = new GroqProvider(logger, { apiKey: SECRET_KEY, model: 'llama-3.3-70b-versatile' });
    try {
      await groq.complete(baseRequest);
      throw new Error('expected complete() to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(JSON.stringify(error)).not.toContain(SECRET_KEY);
    }
  });

  it('OpenRouter: sends optional attribution headers and parses tool calls', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            model: 'openrouter-model',
            choices: [
              {
                message: {
                  content: null,
                  tool_calls: [{ id: 'call_1', function: { name: 'get_time', arguments: '{"tz":"UTC"}' } }],
                },
              },
            ],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const openrouter = new OpenRouterProvider(logger, { apiKey: SECRET_KEY, model: 'some/model' });
    const response = await openrouter.complete(baseRequest);

    expect(response.toolCalls).toEqual([{ id: 'call_1', name: 'get_time', arguments: { tz: 'UTC' } }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((init.headers as Record<string, string>)['X-Title']).toBeTruthy();
  });

  it('OpenRouter: with supportsTools=false, drops tools from the request instead of sending them', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const openrouter = new OpenRouterProvider(logger, {
      apiKey: SECRET_KEY,
      model: 'some/non-tool-model',
      supportsTools: false,
    });
    await openrouter.complete({
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

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.tools).toBeUndefined();
  });

  it('Lovable: sends both the bearer token and the Lovable-API-Key header', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ choices: [{ message: { content: 'hola' } }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const lovable = new LovableProvider(logger, { apiKey: SECRET_KEY, model: 'google/gemini-3.7-flash' });
    const response = await lovable.complete(baseRequest);

    expect(response.text).toBe('hola');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ai.gateway.lovable.dev/v1/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${SECRET_KEY}`);
    expect(headers['Lovable-API-Key']).toBe(SECRET_KEY);
  });

  it('a provider with no model configured reports isConfigured() === false and never calls fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const lovable = new LovableProvider(logger, { apiKey: SECRET_KEY, model: '' });
    expect(lovable.isConfigured()).toBe(false);
    await expect(lovable.complete(baseRequest)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
