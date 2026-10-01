import fs from 'node:fs/promises';
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

export interface CodingAgentOptions {
  workspaceRoot?: string;
  maxFiles?: number;
  /** Commands the agent may run. Anything else is refused even for admins. */
  allowedCommands?: string[];
}

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  'coverage',
  '.turbo',
]);

/**
 * Coding Assistant Agent (Milestone 7).
 *
 * Read-first by design: it can inspect a project and read files, but a
 * write or a terminal command is a `sensitive` action that the
 * Permission Manager gates behind explicit confirmation, and commands
 * are additionally restricted to an allow-list here.
 */
export class CodingAgent implements IActionAgent {
  public readonly id = 'coding-agent';
  public readonly actions = [
    'coding.inspectProject',
    'coding.readFile',
    'coding.writeFile',
    'coding.runCommand',
  ] as const;

  private readonly workspaceRoot: string;
  private readonly maxFiles: number;
  private readonly allowedCommands: string[];

  constructor(
    private readonly logger: ILogger,
    private readonly runner: ICommandRunner,
    options: CodingAgentOptions = {},
  ) {
    this.workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
    this.maxFiles = options.maxFiles ?? 400;
    this.allowedCommands = options.allowedCommands ?? [
      'npm',
      'yarn',
      'node',
      'npx',
      'git',
      'tsc',
      'python',
    ];
  }

  private inWorkspace(target: string): boolean {
    const resolved = path.resolve(target);
    return resolved === this.workspaceRoot || resolved.startsWith(this.workspaceRoot + path.sep);
  }

  async execute(request: ActionRequest): Promise<ActionResult> {
    try {
      switch (request.action) {
        case 'coding.inspectProject':
          return await this.inspectProject(request);
        case 'coding.readFile':
          return await this.readFile(request);
        case 'coding.writeFile':
          return await this.writeFile(request);
        case 'coding.runCommand':
          return await this.runCommand(request);
        default:
          return fail(request.action, `CodingAgent cannot handle action "${request.action}"`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Coding action failed: ${request.action}`, { message });
      return fail(request.action, `Coding operation failed: ${message}`);
    }
  }

  private async inspectProject(request: ActionRequest): Promise<ActionResult> {
    const root = path.resolve(requiredString(request.params, 'path') ?? this.workspaceRoot);
    if (!this.inWorkspace(root)) {
      return fail('coding.inspectProject', `Path "${root}" is outside the workspace.`);
    }

    const files: string[] = [];
    const byExtension = new Map<string, number>();

    const walk = async (dir: string, depth: number): Promise<void> => {
      if (files.length >= this.maxFiles || depth > 8) return;
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true, encoding: 'utf8' });
        for (const entry of entries) {
          if (files.length >= this.maxFiles) return;
          if (entry.isDirectory()) {
            if (IGNORED_DIRECTORIES.has(entry.name)) continue;
            await walk(path.join(dir, entry.name), depth + 1);
            continue;
          }
          const relative = path.relative(root, path.join(dir, entry.name));
          files.push(relative);
          const ext = path.extname(entry.name) || '(none)';
          byExtension.set(ext, (byExtension.get(ext) ?? 0) + 1);
        }
      } catch {
        return;
      }
    };

    await walk(root, 0);

    const languages = [...byExtension.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([extension, count]) => ({ extension, count }));

    return ok(
      'coding.inspectProject',
      `Inspected ${files.length} files in ${path.basename(root)}.`,
      { root, fileCount: files.length, languages, files: files.slice(0, 200) },
    );
  }

  private async readFile(request: ActionRequest): Promise<ActionResult> {
    const target = path.resolve(requiredString(request.params, 'path') ?? '');
    if (!this.inWorkspace(target)) {
      return fail('coding.readFile', `Path "${target}" is outside the workspace.`);
    }
    const content = await fs.readFile(target, 'utf8');
    return ok('coding.readFile', `Read ${path.basename(target)}.`, { path: target, content });
  }

  private async writeFile(request: ActionRequest): Promise<ActionResult> {
    const target = path.resolve(requiredString(request.params, 'path') ?? '');
    if (!this.inWorkspace(target)) {
      return fail('coding.writeFile', `Path "${target}" is outside the workspace.`);
    }
    const content = request.params?.['content'];
    if (typeof content !== 'string') {
      return fail('coding.writeFile', 'No file content was provided.');
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf8');
    return ok('coding.writeFile', `Updated ${path.basename(target)}.`, { path: target });
  }

  private async runCommand(request: ActionRequest): Promise<ActionResult> {
    const command = requiredString(request.params, 'command');
    if (!command) return fail('coding.runCommand', 'No command was provided.');

    const [binary, ...args] = command.split(/\s+/);
    if (!binary || !this.allowedCommands.includes(binary)) {
      return fail(
        'coding.runCommand',
        `The command "${binary ?? ''}" is not on the allowed command list.`,
      );
    }

    const result = await this.runner.run(binary, args);
    return {
      action: 'coding.runCommand',
      ok: result.ok,
      message: result.ok ? `Command finished: ${command}` : `Command failed: ${command}`,
      data: { stdout: result.stdout.slice(-8000), stderr: result.stderr.slice(-4000), code: result.code },
    };
  }

  healthCheck(): ModuleStatus {
    return 'running';
  }
}
