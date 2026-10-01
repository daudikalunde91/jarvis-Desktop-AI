import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import type { ILogger } from '@backend/logging/ILogger';
import { AppError } from '@backend/core/errors/AppError';

export class DatabaseError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DATABASE_ERROR', true, context);
  }
}

/**
 * Owns the single `better-sqlite3` connection for the whole app
 * (Milestone 1 foundation — no schema/migrations live here, callers such
 * as `SqliteMemoryRepository` own their own table definitions against
 * the connection this class hands back).
 *
 * Kept deliberately thin, matching `WindowManager`'s shape: constructor
 * injection of already-resolved config values + a logger, one lifecycle
 * (`connect` -> `getConnection` -> `close`), nothing else.
 */
export class DatabaseManager {
  private db: Database.Database | null = null;

  constructor(
    private readonly directory: string,
    private readonly filename: string,
    private readonly logger: ILogger,
  ) {}

  connect(): void {
    if (this.db) return;

    if (!fs.existsSync(this.directory)) {
      fs.mkdirSync(this.directory, { recursive: true });
    }

    const filePath = path.join(this.directory, this.filename);
    try {
      this.db = new Database(filePath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this.logger.info('Database connected', { filePath });
    } catch (error) {
      throw new DatabaseError('Failed to open the SQLite database', {
        filePath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Returns the live connection. Declared as `Database.Database` here,
   * but callers (e.g. `SqliteMemoryRepository`) should depend on the
   * narrower structural `SqlDatabase` interface (`exec`/`prepare`) they
   * already define, not on this concrete driver type.
   */
  getConnection(): Database.Database {
    if (!this.db) {
      throw new DatabaseError('getConnection() called before connect()');
    }
    return this.db;
  }

  isConnected(): boolean {
    return this.db !== null;
  }

  close(): void {
    if (!this.db) return;
    this.db.close();
    this.db = null;
    this.logger.info('Database connection closed');
  }
}
