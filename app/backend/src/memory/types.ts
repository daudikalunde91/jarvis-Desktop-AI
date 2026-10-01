/**
 * Milestone 3 — Memory System types.
 *
 * Deliberately lightweight for an i3 / 8 GB machine: short-term memory
 * lives in RAM, long-term memory in SQLite. No vector database.
 */

export const MEMORY_KINDS = ['fact', 'preference', 'note', 'conversation'] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export interface MemoryRecord {
  readonly id: string;
  readonly kind: MemoryKind;
  readonly key: string;
  readonly value: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface ConversationTurn {
  readonly id: string;
  readonly sessionId: string;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly createdAt: number;
}

export interface MemoryQuery {
  kind?: MemoryKind;
  search?: string;
  limit?: number;
}

/**
 * Storage backend contract. Two implementations exist:
 * `InMemoryMemoryRepository` (default / tests / memory disabled) and
 * `SqliteMemoryRepository` (durable long-term memory).
 */
export interface IMemoryRepository {
  initialize(): void;
  upsert(record: MemoryRecord): void;
  delete(id: string): boolean;
  clear(kind?: MemoryKind): number;
  list(query?: MemoryQuery): MemoryRecord[];
  findByKey(kind: MemoryKind, key: string): MemoryRecord | undefined;
  appendTurn(turn: ConversationTurn): void;
  listTurns(sessionId: string, limit?: number): ConversationTurn[];
}
