import { describe, expect, it } from 'vitest';

import { ContextManager } from '@backend/ai/ContextManager';
import type { AIMessage } from '@backend/ai/types';

function turn(role: 'user' | 'assistant', content: string): AIMessage {
  return { role, content };
}

describe('ContextManager', () => {
  it('always keeps the system prompt', () => {
    const context = new ContextManager({ maxTurns: 2, maxChars: 10_000 });
    const messages: AIMessage[] = [
      { role: 'system', content: 'you are JARVIS' },
      turn('user', 'hi'),
      turn('assistant', 'hello'),
    ];
    const trimmed = context.trim(messages);
    expect(trimmed[0]).toEqual(messages[0]);
  });

  it('drops the oldest turns beyond maxTurns', () => {
    const context = new ContextManager({ maxTurns: 2, maxChars: 10_000 });
    const messages: AIMessage[] = [
      turn('user', 'turn 1'),
      turn('assistant', 'turn 2'),
      turn('user', 'turn 3'),
      turn('assistant', 'turn 4'),
    ];
    const trimmed = context.trim(messages);
    expect(trimmed.map((m) => m.content)).toEqual(['turn 3', 'turn 4']);
  });

  it('always keeps at least the latest turn even if it alone exceeds the char budget', () => {
    const context = new ContextManager({ maxTurns: 10, maxChars: 5 });
    const messages: AIMessage[] = [turn('user', 'a very long message that exceeds the tiny budget')];
    const trimmed = context.trim(messages);
    expect(trimmed).toHaveLength(1);
  });

  it('drops older turns once the char budget is exhausted', () => {
    const context = new ContextManager({ maxTurns: 10, maxChars: 12 });
    const messages: AIMessage[] = [turn('user', 'first message is long'), turn('assistant', 'short')];
    const trimmed = context.trim(messages);
    expect(trimmed.map((m) => m.content)).toEqual(['short']);
  });
});
