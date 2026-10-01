import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { ILogger } from '@backend/logging/ILogger';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { ICommandRunner } from '@backend/agents/runtime/ShellCommandRunner';
import {
  fail,
  ok,
  requiredString,
  type ActionRequest,
  type ActionResult,
  type IActionAgent,
} from '@backend/agents/types';

export interface FileAgentOptions {
  /** Absolute directories JARVIS may touch. Anything outside is refused. */
  allowedRoots?: string[];
  maxSearchResults?: number;
  maxReadBytes?: number;
}

/** Common spoken folder aliases -> real paths under the user's home. */
const FOLDER_ALIASES: Record<string, string> = {
  downloads: 'Downloads',
  documents: 'Documents',
  desktop: 'Desktop',
  pictures: 'Pictures',
  music: 'Music',
  videos: 'Videos',
  nyaraka: 'Documents',
  picha: 'Pictures',
  muziki: 'Music',
};

/**
 * File Management Agent (Milestone 5).
 *
 * Every path is resolved and then validated against `allowedRoots`
 * before any filesystem call — path traversal outside the sandbox is
 * rejected regardless of the caller's permission role.
 */
export class FileAgent implements IActionAgent {
  public readonly id = 'file-agent';
  public readonly actions = [
    'file.list',
    'file.search',
    'file.read',
    'file.create',
    'file.createFolder',
    'file.rename',
    'file.move',
    'file.copy',
    'file.delete',
    'file.open',
  ] as const;

  private readonly allowedRoots: string[];
  private readonly maxSearchResults: number;
  private readonly maxReadBytes: number;

  constructor(
    private readonly logger: ILogger,
    private readonly runner: ICommandRunner,
    options: FileAgentOptions = {},
  ) {
    this.allowedRoots = (options.allowedRoots ?? [os.homedir()]).map((root) => path.resolve(root));
    this.maxSearchResults = options.maxSearchResults ?? 100;
    this.maxReadBytes = options.maxReadBytes ?? 200_000;
  }

  resolvePath(input: string): string {
    const alias = FOLDER_ALIASES[input.trim().toLowerCase()];
    if (alias) return path.join(os.homedir(), alias);
    if (path.isAbsolute(input)) return path.resolve(input);
    return path.resolve(os.homedir(), input);
  }

  isAllowed(target: string): boolean {
    const resolved = path.resolve(target);
    return this.allowedRoots.some(
      (root) => resolved === root || resolved.startsWith(root + path.sep),
    );
  }

  private guard(target: string): string | null {
    return this.isAllowed(target) ? null : `Path "${target}" is outside the allowed folders.`;
  }

  async execute(request: ActionRequest): Promise<ActionResult> {
    try {
      switch (request.action) {
        case 'file.list':
          return await this.list(request);
        case 'file.search':
          return await this.search(request);
        case 'file.read':
          return await this.read(request);
        case 'file.create':
          return await this.createFile(request);
        case 'file.createFolder':
          return await this.createFolder(request);
        case 'file.rename':
        case 'file.move':
          return await this.moveOrRename(request);
        case 'file.copy':
          return await this.copy(request);
        case 'file.delete':
          return await this.remove(request);
        case 'file.open':
          return await this.open(request);
        default:
          return fail(request.action, `FileAgent cannot handle action "${request.action}"`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`File action failed: ${request.action}`, { message });
      return fail(request.action, `File operation failed: ${message}`);
    }
  }

  private async list(request: ActionRequest): Promise<ActionResult> {
    const target = this.resolvePath(requiredString(request.params, 'path') ?? '.');
    const denied = this.guard(target);
    if (denied) return fail('file.list', denied);

    const entries = await fs.readdir(target, { withFileTypes: true });
    const data = entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'folder' : 'file',
      path: path.join(target, entry.name),
    }));
    return ok('file.list', `Found ${data.length} items in ${target}.`, data);
  }

  private async search(request: ActionRequest): Promise<ActionResult> {
    const target = this.resolvePath(requiredString(request.params, 'path') ?? '.');
    const denied = this.guard(target);
    if (denied) return fail('file.search', denied);

    const query = (requiredString(request.params, 'query') ?? '').toLowerCase();
    const extension = requiredString(request.params, 'extension');
    const matches: string[] = [];

    const walk = async (dir: string, depth: number): Promise<void> => {
      if (matches.length >= this.maxSearchResults || depth > 6) return;
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true, encoding: 'utf8' });
        for (const entry of entries) {
        if (matches.length >= this.maxSearchResults) return;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full, depth + 1);
          continue;
        }
        const nameMatches = query.length === 0 || entry.name.toLowerCase().includes(query);
        const extMatches =
          !extension || entry.name.toLowerCase().endsWith(`.${extension.replace(/^\./, '')}`);
        if (nameMatches && extMatches) matches.push(full);
        }
      } catch {
        return;
      }
    };

    await walk(target, 0);
    const label = extension ? `${extension.toUpperCase()} files` : 'files';
    return ok('file.search', `Found ${matches.length} ${label} in ${target}.`, matches);
  }

  private async read(request: ActionRequest): Promise<ActionResult> {
    const target = this.resolvePath(requiredString(request.params, 'path') ?? '');
    const denied = this.guard(target);
    if (denied) return fail('file.read', denied);

    const content = await fs.readFile(target, 'utf8');
    const truncated = content.length > this.maxReadBytes;
    return ok('file.read', `Read ${path.basename(target)}.`, {
      path: target,
      truncated,
      content: truncated ? content.slice(0, this.maxReadBytes) : content,
    });
  }

  private async createFile(request: ActionRequest): Promise<ActionResult> {
    const target = this.resolvePath(requiredString(request.params, 'path') ?? '');
    const denied = this.guard(target);
    if (denied) return fail('file.create', denied);

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, String(request.params?.['content'] ?? ''), 'utf8');
    return ok('file.create', `Created ${path.basename(target)}.`, { path: target });
  }

  private async createFolder(request: ActionRequest): Promise<ActionResult> {
    const name = requiredString(request.params, 'name') ?? requiredString(request.params, 'path');
    if (!name) return fail('file.createFolder', 'No folder name was provided.');
    const parent = requiredString(request.params, 'parent');
    const target = parent ? path.join(this.resolvePath(parent), name) : this.resolvePath(name);

    const denied = this.guard(target);
    if (denied) return fail('file.createFolder', denied);

    await fs.mkdir(target, { recursive: true });
    return ok('file.createFolder', `Created the folder ${path.basename(target)}.`, {
      path: target,
    });
  }

  private async moveOrRename(request: ActionRequest): Promise<ActionResult> {
    const from = this.resolvePath(requiredString(request.params, 'from') ?? '');
    const rawTo = requiredString(request.params, 'to') ?? '';
    const to = path.isAbsolute(rawTo) ? path.resolve(rawTo) : path.join(path.dirname(from), rawTo);

    const denied = this.guard(from) ?? this.guard(to);
    if (denied) return fail(request.action, denied);

    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.rename(from, to);
    return ok(request.action, `Moved ${path.basename(from)} to ${to}.`, { from, to });
  }

  private async copy(request: ActionRequest): Promise<ActionResult> {
    const from = this.resolvePath(requiredString(request.params, 'from') ?? '');
    const to = this.resolvePath(requiredString(request.params, 'to') ?? '');
    const denied = this.guard(from) ?? this.guard(to);
    if (denied) return fail('file.copy', denied);

    await fs.cp(from, to, { recursive: true });
    return ok('file.copy', `Copied ${path.basename(from)} to ${to}.`, { from, to });
  }

  private async remove(request: ActionRequest): Promise<ActionResult> {
    const target = this.resolvePath(requiredString(request.params, 'path') ?? '');
    const denied = this.guard(target);
    if (denied) return fail('file.delete', denied);

    await fs.rm(target, { recursive: true, force: false });
    return ok('file.delete', `Deleted ${path.basename(target)}.`, { path: target });
  }

  private async open(request: ActionRequest): Promise<ActionResult> {
    const target = this.resolvePath(requiredString(request.params, 'path') ?? '');
    const denied = this.guard(target);
    if (denied) return fail('file.open', denied);

    const result = await this.runner.run('cmd.exe', ['/c', 'start', '', target]);
    if (!result.ok) return fail('file.open', `I could not open ${target}.`);
    return ok('file.open', `Opening ${path.basename(target)}.`, {
      path: target,
      simulated: result.simulated,
    });
  }

  healthCheck(): ModuleStatus {
    return 'running';
  }
}
