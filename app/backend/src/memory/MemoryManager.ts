import type { ILogger } from '@backend/logging/ILogger';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { IHealthCheckable } from '@backend/shared/interfaces/IHealthCheckable';
import { generateId } from '@backend/shared/utilities/generateId';
import { InMemoryMemoryRepository } from '@backend/memory/InMemoryMemoryRepository';
import type {
  ConversationTurn,
  IMemoryRepository,
  MemoryKind,
  MemoryQuery,
  MemoryRecord,
} from '@backend/memory/types';

export interface MemoryManagerConfig {
  /** When false, nothing is written; reads return empty. User-controllable. */
  enabled: boolean;
  /** How many recent turns the short-term (RAM) window keeps per session. */
  shortTermWindow: number;
}

export const DEFAULT_MEMORY_CONFIG: MemoryManagerConfig = {
  enabled: true,
  shortTermWindow: 12,
};

/**
 * Memory System (Milestone 3).
 *
 * Short-term memory = a bounded per-session window held in RAM.
 * Long-term memory = whatever `IMemoryRepository` is injected (SQLite in
 * production). The user can view, edit, delete, and disable everything —
 * `setEnabled(false)` makes the whole subsystem inert without any other
 * component needing to know.
 */
export class MemoryManager implements IHealthCheckable {
  private readonly shortTerm = new Map<string, ConversationTurn[]>();
  private config: MemoryManagerConfig;

  constructor(
    private readonly logger: ILogger,
    private readonly repository: IMemoryRepository = new InMemoryMemoryRepository(),
    config: Partial<MemoryManagerConfig> = {},
  ) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
  }

  initialize(): void {
    this.repository.initialize();
    this.logger.info('Memory system initialized', { enabled: this.config.enabled });
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.config = { ...this.config, enabled };
    if (!enabled) this.shortTerm.clear();
    this.logger.info(`Memory system ${enabled ? 'enabled' : 'disabled'}`);
  }

  // ---- Long-term memory ----

  remember(kind: MemoryKind, key: string, value: string): MemoryRecord | null {
    if (!this.config.enabled) return null;
    const now = Date.now();
    const existing = this.repository.findByKey(kind, key);
    const record: MemoryRecord = {
      id: existing?.id ?? generateId(),
      kind,
      key,
      value,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.repository.upsert(record);
    return record;
  }

  recall(kind: MemoryKind, key: string): MemoryRecord | undefined {
    if (!this.config.enabled) return undefined;
    return this.repository.findByKey(kind, key);
  }

  search(query: MemoryQuery = {}): MemoryRecord[] {
    if (!this.config.enabled) return [];
    return this.repository.list(query);
  }

  forget(id: string): boolean {
    if (!this.config.enabled) return false;
    return this.repository.delete(id);
  }

  forgetAll(kind?: MemoryKind): number {
    if (!this.config.enabled) return 0;
    return this.repository.clear(kind);
  }

  // ---- Short-term memory + conversation log ----

  recordTurn(sessionId: string, role: 'user' | 'assistant', text: string): ConversationTurn | null {
    if (!this.config.enabled) return null;
    const turn: ConversationTurn = {
      id: generateId(),
      sessionId,
      role,
      text,
      createdAt: Date.now(),
    };

    const window = this.shortTerm.get(sessionId) ?? [];
    window.push(turn);
    while (window.length > this.config.shortTermWindow) window.shift();
    this.shortTerm.set(sessionId, window);

    this.repository.appendTurn(turn);
    return turn;
  }

  getShortTerm(sessionId: string): ConversationTurn[] {
    return [...(this.shortTerm.get(sessionId) ?? [])];
  }

  getHistory(sessionId: string, limit = 50): ConversationTurn[] {
    if (!this.config.enabled) return [];
    return this.repository.listTurns(sessionId, limit);
  }

  clearSession(sessionId: string): void {
    this.shortTerm.delete(sessionId);
  }

  healthCheck(): ModuleStatus {
    return this.config.enabled ? 'running' : 'stopped';
  }
}
