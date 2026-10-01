import { afterEach, describe, expect, it, vi } from 'vitest';

import { GeminiProvider } from '@backend/ai/providers/GeminiProvider';
import { AuthenticationError, ModelUnavailableError } from '@backend/ai/errors';
import type { AICompletionRequest } from '@backend/ai/types';

const logger = { error: () => {}, warn: () => {}, info: () => {}, debug: () => {}, log: () => {} };
const API_KEY = 'gemini-test-key';

const baseRequest: AICompletionRequest = {
  sessionId: 's1',
  taskType: 'general',
  messages: [{ role: 'user', content: 'hello' }],
};

function ok(text = 'hi there') {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
}

function notFound() {
  return new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404 });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GeminiProvider model discovery/fallback (Feature A / G)', () => {
  it('a healthy configured model never triggers a models.list call', async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);

    const gemini = new GeminiProvider(logger, { apiKey: API_KEY, model: 'gemini-3.6-flash' });
    const response = await gemini.complete(baseRequest);

    expect(response.text).toBe('hi there');
    expect(fetchMock).toHaveBeenCalledTimes(1); // no discovery call
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain(':generateContent');
    expect(url).not.toContain('/models?');
  });

  it('sends the key as a header, not a query param', async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    const gemini = new GeminiProvider(logger, { apiKey: API_KEY, model: 'gemini-3.6-flash' });
    await gemini.complete(baseRequest);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain(API_KEY);
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(API_KEY);
  });

  it('on a 404, discovers a working replacement model and retries once, then reuses it for later calls', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/models/gemini-old-model')) return notFound();
      if (url.endsWith('/models')) {
        return new Response(
          JSON.stringify({
            models: [
              { name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] },
              { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('/models/gemini-3.6-flash')) return ok('discovered-model-response');
      throw new Error(`unexpected url in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const gemini = new GeminiProvider(logger, { apiKey: API_KEY, model: 'gemini-old-model' });
    const first = await gemini.complete(baseRequest);
    expect(first.text).toBe('discovered-model-response');
    expect(first.model).toBe('gemini-3.6-flash');

    // Second call should go straight to the resolved model — no repeat discovery, no repeat 404.
    const callsAfterFirst = fetchMock.mock.calls.length;
    const second = await gemini.complete(baseRequest);
    expect(second.text).toBe('discovered-model-response');
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst + 1); // exactly one more call, straight to the resolved model
  });

  it('falls back to the static documented model list when live discovery itself fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/models')) return new Response('discovery unavailable', { status: 500 });
      if (url.includes('/models/gemini-old-model')) return notFound();
      // Documented fallback list starts with gemini-flash-latest.
      if (url.includes('/models/gemini-flash-latest')) return ok('static-fallback-response');
      throw new Error(`unexpected url in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const gemini = new GeminiProvider(logger, { apiKey: API_KEY, model: 'gemini-old-model' });
    const response = await gemini.complete(baseRequest);
    expect(response.text).toBe('static-fallback-response');
    expect(response.model).toBe('gemini-flash-latest');
  });

  it('never hides the original error when the fallback model also fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/models')) return new Response('discovery unavailable', { status: 500 });
      return notFound(); // every model 404s
    });
    vi.stubGlobal('fetch', fetchMock);

    const gemini = new GeminiProvider(logger, { apiKey: API_KEY, model: 'gemini-old-model' });
    try {
      await gemini.complete(baseRequest);
      throw new Error('expected complete() to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ModelUnavailableError);
      const context = (error as ModelUnavailableError).context as Record<string, unknown>;
      expect(context.configuredModel).toBe('gemini-old-model');
      expect(context.attemptedFallbackModel).toBeTruthy();
    }
  });

  it('a non-model error (e.g. auth) is never retried against a fallback model', async () => {
    const fetchMock = vi.fn(async () => new Response('unauthorized', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const gemini = new GeminiProvider(logger, { apiKey: API_KEY, model: 'gemini-3.6-flash' });
    await expect(gemini.complete(baseRequest)).rejects.toBeInstanceOf(AuthenticationError);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no discovery attempt, no retry
  });

  it('modelDiscoveryEnabled=false skips fallback entirely and surfaces the raw 404', async () => {
    const fetchMock = vi.fn(async () => notFound());
    vi.stubGlobal('fetch', fetchMock);
    const gemini = new GeminiProvider(logger, {
      apiKey: API_KEY,
      model: 'gemini-old-model',
      modelDiscoveryEnabled: false,
    });
    await expect(gemini.complete(baseRequest)).rejects.toBeInstanceOf(ModelUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no /models call, no retry
  });
});
