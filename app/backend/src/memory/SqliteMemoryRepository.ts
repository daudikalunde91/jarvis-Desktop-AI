import type {
  ConversationTurn,
  IMemoryRepository,
  MemoryKind,
  MemoryQuery,
  MemoryRecord,
} from '@backend/memory/types';

/**
 * Minimal structural view of a `better-sqlite3` database. Declared here
 * (instead of importing the driver) so the memory layer stays testable
 * with a fake and the native module remains an implementation detail of
 * `database/DatabaseManager`.
 */
export interface SqlStatement {
  run(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
}

export interface SqlDatabase {
  exec(sql: string): unknown;
  prepare(sql: string): SqlStatement;
}

interface MemoryRow {
  id: string;
  kind: string;
  key: string;
  value: string;
  created_at: number;
  updated_at: number;
}

interface TurnRow {
  id: string;
  session_id: string;
  role: string;
  text: string;
  created_at: number;
}

/**
 * Durable long-term memory (Milestone 3). Schema is created on
 * `initialize()`; there is no ORM and no vector index by design.
 */
export class SqliteMemoryRepository implements IMemoryRepository {
  constructor(private readonly db: SqlDatabase) {}

  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_records (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_kind_key ON memory_records(kind, key);
      CREATE TABLE IF NOT EXISTS conversation_turns (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_turns_session ON conversation_turns(session_id);
    `);
  }

  upsert(record: MemoryRecord): void {
    this.db
      .prepare(
        `INSERT INTO memory_records (id, kind, key, value, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(kind, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(record.id, record.kind, record.key, record.value, record.createdAt, record.updatedAt);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM memory_records WHERE id = ?').run(id) as {
      changes?: number;
    };
    return (result?.changes ?? 0) > 0;
  }

  clear(kind?: MemoryKind): number {
    const result = (
      kind
        ? this.db.prepare('DELETE FROM memory_records WHERE kind = ?').run(kind)
        : this.db.prepare('DELETE FROM memory_records').run()
    ) as { changes?: number };
    return result?.changes ?? 0;
  }

  list(query: MemoryQuery = {}): MemoryRecord[] {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (query.kind) {
      clauses.push('kind = ?');
      params.push(query.kind);
    }
    if (query.search) {
      clauses.push('(key LIKE ? OR value LIKE ?)');
      params.push(`%${query.search}%`, `%${query.search}%`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = query.limit ? `LIMIT ${Math.max(1, Math.floor(query.limit))}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM memory_records ${where} ORDER BY updated_at DESC ${limit}`)
      .all(...params) as MemoryRow[];
    return rows.map(toRecord);
  }

  findByKey(kind: MemoryKind, key: string): MemoryRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM memory_records WHERE kind = ? AND key = ?')
      .get(kind, key) as MemoryRow | undefined;
    return row ? toRecord(row) : undefined;
  }

  appendTurn(turn: ConversationTurn): void {
    this.db
      .prepare(
        'INSERT INTO conversation_turns (id, session_id, role, text, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(turn.id, turn.sessionId, turn.role, turn.text, turn.createdAt);
  }

  listTurns(sessionId: string, limit = 50): ConversationTurn[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM conversation_turns WHERE session_id = ? ORDER BY created_at DESC LIMIT ?',
      )
      .all(sessionId, Math.max(1, Math.floor(limit))) as TurnRow[];
    return rows
      .map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        role: row.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        text: row.text,
        createdAt: row.created_at,
      }))
      .reverse();
  }
}

function toRecord(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    kind: row.kind as MemoryKind,
    key: row.key,
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
