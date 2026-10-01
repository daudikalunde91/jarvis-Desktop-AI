import { execFile } from 'node:child_process';
import os from 'node:os';

export interface CommandResult {
  readonly ok: boolean;
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  /** True when the command was not actually executed (simulation mode). */
  readonly simulated: boolean;
}

/**
 * Boundary between JARVIS and the operating system shell. Everything
 * that touches PowerShell / a system binary goes through this interface,
 * so the whole action layer stays unit-testable and can run in
 * simulation mode on non-Windows machines.
 */
export interface ICommandRunner {
  readonly platform: NodeJS.Platform;
  readonly simulate: boolean;
  run(command: string, args?: readonly string[]): Promise<CommandResult>;
  /** Runs a PowerShell expression (Windows) or reports simulation elsewhere. */
  powershell(script: string): Promise<CommandResult>;
}

export interface CommandRunnerOptions {
  /** Never execute — only record what *would* run. Default: non-Windows hosts. */
  simulate?: boolean;
  timeoutMs?: number;
  platform?: NodeJS.Platform;
}

export class ShellCommandRunner implements ICommandRunner {
  public readonly platform: NodeJS.Platform;
  public readonly simulate: boolean;
  private readonly timeoutMs: number;
  private readonly history: string[] = [];

  constructor(options: CommandRunnerOptions = {}) {
    this.platform = options.platform ?? os.platform();
    this.simulate = options.simulate ?? this.platform !== 'win32';
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  getHistory(): readonly string[] {
    return this.history;
  }

  run(command: string, args: readonly string[] = []): Promise<CommandResult> {
    this.history.push([command, ...args].join(' '));

    if (this.simulate) {
      return Promise.resolve({
        ok: true,
        code: 0,
        stdout: `[simulated] ${[command, ...args].join(' ')}`,
        stderr: '',
        simulated: true,
      });
    }

    return new Promise<CommandResult>((resolve) => {
      execFile(
        command,
        [...args],
        { timeout: this.timeoutMs, windowsHide: true },
        (error, stdout, stderr) => {
          resolve({
            ok: !error,
            code: error && typeof error.code === 'number' ? error.code : error ? 1 : 0,
            stdout: String(stdout ?? ''),
            stderr: String(stderr ?? (error ? error.message : '')),
            simulated: false,
          });
        },
      );
    });
  }

  powershell(script: string): Promise<CommandResult> {
    if (this.platform !== 'win32') {
      this.history.push(`powershell: ${script}`);
      return Promise.resolve({
        ok: true,
        code: 0,
        stdout: `[simulated powershell] ${script}`,
        stderr: '',
        simulated: true,
      });
    }
    return this.run('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script,
    ]);
  }
}
