import { afterEach, describe, expect, it, vi } from 'vitest';

import { ClaudeProvider } from '@backend/ai/providers/ClaudeProvider';
import { OpenAIProvider } from '@backend/ai/providers/OpenAIProvider';
import { GroqProvider } from '@backend/ai/providers/GroqProvider';
import { ProviderToolNameCodec, toProviderSafeName } from '@backend/ai/tools/ProviderToolNames';
import { AI_TOOL_MAPPINGS } from '@backend/ai/tools/ToolDefinitions';
import type { AICompletionRequest, AIToolDefinition } from '@backend/ai/types';

const logger = { error: () => {}, warn: () => {}, info: () => {}, debug: () => {}, log: () => {} };
const WIRE_NAME = /^[a-zA-Z0-9_-]{1,64}$/;

const tool = (name: string): AIToolDefinition => ({
  name,
  description: name,
  parameters: { type: 'object', properties: {} },
  minRole: 'user',
  requiresConfirmation: false,
});

afterEach(() => vi.unstubAllGlobals());

const TOOL_DEFINITIONS = AI_TOOL_MAPPINGS.map((m) => m.definition);

describe('ProviderToolNameCodec', () => {
  it('maps dotted internal names to wire-safe names and back', () => {
    const codec = new ProviderToolNameCodec([tool('system.get_info'), tool('files.create_folder')]);
    expect(codec.encode('system.get_info')).toBe('system_get_info');
    expect(codec.encode('files.create_folder')).toBe('files_create_folder');
    // Decoding is a lookup, so underscores in the real name survive.
    expect(codec.decode('files_create_folder')).toBe('files.create_folder');
    expect(codec.decode('system_get_info')).toBe('system.get_info');
  });

  it('keeps colliding names distinct and reversible', () => {
    const codec = new ProviderToolNameCodec([tool('a.b'), tool('a_b')]);
    const [x, y] = [codec.encode('a.b'), codec.encode('a_b')];
    expect(x).not.toBe(y);
    expect(codec.decode(x)).toBe('a.b');
    expect(codec.decode(y)).toBe('a_b');
  });

  it('passes unknown wire names through and never returns an empty/invalid name', () => {
    const codec = new ProviderToolNameCodec([]);
    expect(codec.decode('made_up_tool')).toBe('made_up_tool');
    expect(WIRE_NAME.test(toProviderSafeName('weird name!/x'))).toBe(true);
    expect(WIRE_NAME.test(toProviderSafeName(''))).toBe(true);
    expect(toProviderSafeName('x'.repeat(200)).length).toBe(64);
  });

  it('every real JARVIS tool definition encodes to a valid, unique wire name', () => {
    const codec = new ProviderToolNameCodec(TOOL_DEFINITIONS);
    const wire = TOOL_DEFINITIONS.map((t) => codec.encode(t.name));
    for (const name of wire) expect(name).toMatch(WIRE_NAME);
    expect(new Set(wire).size).toBe(wire.length);
    for (const t of TOOL_DEFINITIONS) expect(codec.decode(codec.encode(t.name))).toBe(t.name);
  });
});

const toolRequest: AICompletionRequest = {
  sessionId: 's1',
  taskType: 'general',
  messages: [
    { role: 'user', content: 'open vs code' },
    { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'app.open', arguments: { name: 'code' } }] },
    { role: 'tool', content: 'ok', toolCallId: 'c1', toolName: 'app.open' },
  ],
  tools: [tool('app.open'), tool('files.create_folder')],
};

function bodyOf(fetchMock: ReturnType<typeof vi.fn>): any {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(init.body as string);
}

describe('providers send wire-safe tool names and restore internal names', () => {
  it('OpenAI', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '', tool_calls: [{ id: 'c2', function: { name: 'files_create_folder', arguments: '{"name":"x"}' } }] } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await new OpenAIProvider(logger, { apiKey: 'k', model: 'm' }).complete(toolRequest);
    const body = bodyOf(fetchMock);
    expect(body.tools.map((t: any) => t.function.name)).toEqual(['app_open', 'files_create_folder']);
    expect(body.messages[1].tool_calls[0].function.name).toBe('app_open');
    expect(res.toolCalls[0]?.name).toBe('files.create_folder');
  });

  it('Groq (OpenAI-compatible base, shared by OpenRouter/Lovable)', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '', tool_calls: [{ id: 'c2', function: { name: 'app_open', arguments: '{}' } }] } }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await new GroqProvider(logger, { apiKey: 'k', model: 'm' }).complete(toolRequest);
    const body = bodyOf(fetchMock);
    for (const t of body.tools) expect(t.function.name).toMatch(WIRE_NAME);
    expect(res.toolCalls[0]?.name).toBe('app.open');
  });

  it('Claude', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ content: [{ type: 'tool_use', id: 'c2', name: 'files_create_folder', input: { name: 'x' } }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await new ClaudeProvider(logger, { apiKey: 'k', model: 'm' }).complete(toolRequest);
    const body = bodyOf(fetchMock);
    expect(body.tools.map((t: any) => t.name)).toEqual(['app_open', 'files_create_folder']);
    expect(body.messages[1].content[0].name).toBe('app_open');
    expect(res.toolCalls[0]?.name).toBe('files.create_folder');
  });
});
