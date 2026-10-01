import fs from 'node:fs';
import path from 'node:path';

import type { ILogTransport, LogMeta } from '@backend/logging/ILogger';
import type { LogLevel } from '@backend/core/constants';

/**
 * Appends log lines to a rotating-by-day log file inside the configured
 * log directory. Kept intentionally simple for the foundation milestone —
 * rotation/retention policies belong to a later milestone.
 */
export class FileTransport implements ILogTransport {
  private readonly logDirectory: string;

  constructor(logDirectory: string) {
    this.logDirectory = logDirectory;
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }

  private get currentFilePath(): string {
    const datePart = new Date().toISOString().slice(0, 10);
    return path.join(this.logDirectory, `jarvis-${datePart}.log`);
  }

  write(level: LogLevel, message: string, meta?: LogMeta): void {
    const timestamp = new Date().toISOString();
    const metaString = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}\n`;

    fs.appendFile(this.currentFilePath, line, (err) => {
      if (err) {
        // Intentionally avoid throwing from within the logger itself.
        console.error('Failed to write log file:', err);
      }
    });
  }
}
