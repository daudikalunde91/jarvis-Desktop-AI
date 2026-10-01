import type {
  ConversationTurn,
  IMemoryRepository,
  MemoryKind,
  MemoryQuery,
  MemoryRecord,
} from '@backend/memory/types';

/**
 * RAM-backed repository. Used when long-term memory is disabled and as
 * the reference implementation the SQLite repository must match.
 */
export class InMemoryMemoryRepository implements IMemoryRepository {
  private readonly records = new Map<string, MemoryRecord>();
  private readonly turns: ConversationTurn[] = [];

  initialize(): void {
    // Nothing to prepare.
  }

  upsert(record: MemoryRecord): void {
    const existing = this.findByKey(record.kind, record.key);
    if (existing) this.records.delete(existing.id);
    this.records.set(record.id, record);
  }

  delete(id: string): boolean {
    return this.records.delete(id);
  }

  clear(kind?: MemoryKind): number {
    let removed = 0;
    for (const [id, record] of this.records) {
      if (!kind || record.kind === kind) {
        this.records.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  list(query: MemoryQuery = {}): MemoryRecord[] {
    const search = query.search?.toLowerCase();
    const results = [...this.records.values()]
      .filter((record) => (query.kind ? record.kind === query.kind : true))
      .filter((record) =>
        search
          ? record.key.toLowerCase().includes(search) || record.value.toLowerCase().includes(search)
          : true,
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return query.limit ? results.slice(0, query.limit) : results;
  }

  findByKey(kind: MemoryKind, key: string): MemoryRecord | undefined {
    return [...this.records.values()].find(
      (record) => record.kind === kind && record.key.toLowerCase() === key.toLowerCase(),
    );
  }

  appendTurn(turn: ConversationTurn): void {
    this.turns.push(turn);
  }

  listTurns(sessionId: string, limit = 50): ConversationTurn[] {
    return this.turns.filter((turn) => turn.sessionId === sessionId).slice(-limit);
  }
}
