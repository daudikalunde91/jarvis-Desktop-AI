import { afterEach, describe, expect, it, vi } from 'vitest';

import { ClaudeProvider } from '@backend/ai/providers/ClaudeProvider';
import type { AICompletionRequest } from '@backend/ai/types';

const logger = { error: () => {}, warn: () => {}, info: () => {}, debug: () => {}, log: () => {} };
const API_KEY = 'sk-ant-test-key';

const baseRequest: AICompletionRequest = {
  sessionId: 's1',
  taskType: 'general',
  messages: [{ role: 'user', content: 'hello' }],
};

function claudeOkResponse() {
  return new Response(
    JSON.stringify({ model: 'claude-sonnet-4-6', content: [{ type: 'text', text: 'hi' }] }),
    { status: 200 },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ClaudeProvider workspace header', () => {
  it('omits anthropic-workspace-id entirely when not configured (default/standard api.anthropic.com usage)', async () => {
    const fetchMock = vi.fn(async () => claudeOkResponse());
    vi.stubGlobal('fetch', fetchMock);

    const claude = new ClaudeProvider(logger, { apiKey: API_KEY, model: 'claude-sonnet-4-6' });
    await claude.complete(baseRequest);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['anthropic-workspace-id']).toBeUndefined();
    expect(headers['x-api-key']).toBe(API_KEY);
  });

  it('sends anthropic-workspace-id when a workspaceId is configured (e.g. Claude Platform on AWS)', async () => {
    const fetchMock = vi.fn(async () => claudeOkResponse());
    vi.stubGlobal('fetch', fetchMock);

    const claude = new ClaudeProvider(logger, {
      apiKey: API_KEY,
      model: 'claude-sonnet-4-6',
      workspaceId: 'wrkspc_test_123',
    });
    await claude.complete(baseRequest);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['anthropic-workspace-id']).toBe('wrkspc_test_123');
  });
});
