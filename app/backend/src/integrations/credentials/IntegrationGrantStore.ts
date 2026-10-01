import fs from 'node:fs';
import path from 'node:path';

import { isIntegrationCapability, type IntegrationCapability } from '@backend/integrations/capabilities';
import type { IntegrationId } from '@backend/integrations/types';

/**
 * Non-secret record of which capabilities the user granted per integration.
 * Contains capability names only — never tokens or account data.
 */
export class IntegrationGrantStore {
  constructor(private readonly filePath: string) {}

  private readAll(): Record<string, IntegrationCapability[]> {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Record<string, unknown>;
      const out: Record<string, IntegrationCapability[]> = {};
      for (const [id, caps] of Object.entries(parsed)) {
        if (Array.isArray(caps)) out[id] = caps.filter(isIntegrationCapability);
      }
      return out;
    } catch {
      return {};
    }
  }

  get(id: IntegrationId): readonly IntegrationCapability[] {
    return this.readAll()[id] ?? [];
  }

  set(id: IntegrationId, capabilities: readonly IntegrationCapability[]): void {
    const all = this.readAll();
    all[id] = [...new Set(capabilities)];
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(all, null, 2), 'utf8');
  }

  clear(id: IntegrationId): void {
    const all = this.readAll();
    delete all[id];
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(all, null, 2), 'utf8');
  }
}
