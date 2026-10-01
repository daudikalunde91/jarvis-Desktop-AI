import fs from 'node:fs';
import path from 'node:path';

import type { ILogger } from '@backend/logging/ILogger';
import { RUNTIME_DIRECTORIES } from '@backend/core/constants';

/**
 * Ensures the runtime directory layout described in RUNTIME_DIRECTORIES
 * exists relative to the project root before any other subsystem
 * (config, logging, database) attempts to read from or write to it.
 */
export class FolderBootstrap {
  constructor(
    private readonly rootDir: string,
    private readonly logger: ILogger,
  ) {}

  run(): void {
    for (const directory of Object.values(RUNTIME_DIRECTORIES)) {
      const fullPath = path.join(this.rootDir, directory);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        this.logger.info(`Bootstrapped missing directory: ${directory}`);
      }
    }
  }
}
