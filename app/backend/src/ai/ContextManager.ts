import type { AIMessage } from '@backend/ai/types';

export interface ContextManagerOptions {
  /** Hard cap on turns (excluding system prompt) sent to a provider. */
  readonly maxTurns?: number;
  /** Hard cap on total characters sent, as a cheap token-budget proxy. */
  readonly maxChars?: number;
}

/**
 * Keeps provider requests bounded. JARVIS's own MemoryManager remains the
 * source of truth for conversation history — this class only decides how
 * much of it is worth spending on a single cloud request.
 */
export class ContextManager {
  private readonly maxTurns: number;
  private readonly maxChars: number;

  constructor(options: ContextManagerOptions = {}) {
    this.maxTurns = options.maxTurns ?? 12;
    this.maxChars = options.maxChars ?? 8000;
  }

  /**
   * Returns the system prompt (if any) plus the most recent turns that fit
   * within the configured budget, oldest-first, never truncating a
   * message mid-sentence — we drop whole turns instead.
   */
  trim(messages: readonly AIMessage[]): AIMessage[] {
    const system = messages.filter((m) => m.role === 'system');
    const rest = messages.filter((m) => m.role !== 'system').slice(-this.maxTurns);

    const kept: AIMessage[] = [];
    let charBudget = this.maxChars - system.reduce((sum, m) => sum + m.content.length, 0);
    for (let i = rest.length - 1; i >= 0; i -= 1) {
      const turn = rest[i];
      charBudget -= turn.content.length;
      if (charBudget < 0 && kept.length > 0) break; // always keep at least the latest turn
      kept.unshift(turn);
    }

    return [...system, ...kept];
  }
}
