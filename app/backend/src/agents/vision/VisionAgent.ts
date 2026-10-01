import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ILogger } from '@backend/logging/ILogger';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { ICommandRunner } from '@backend/agents/runtime/ShellCommandRunner';
import { fail, ok, requiredString, type ActionRequest, type ActionResult, type IActionAgent } from '@backend/agents/types';

export class VisionAgent implements IActionAgent {
  public readonly id = 'vision-agent';
  public readonly actions = ['vision.capture'] as const;
  constructor(private readonly logger: ILogger, private readonly runner: ICommandRunner) {}

  async execute(request: ActionRequest): Promise<ActionResult> {
    if (request.action !== 'vision.capture') return fail(request.action, `VisionAgent cannot handle action "${request.action}"`);
    if (process.platform !== 'win32') return fail(request.action, 'Screen capture is currently implemented for Windows only.');
    const rawPath = requiredString(request.params, 'outputPath') ?? path.join('Pictures', 'JARVIS', `screen-${Date.now()}.png`);
    const value = path.isAbsolute(rawPath) ? path.resolve(rawPath) : path.resolve(os.homedir(), rawPath);
    const home = path.resolve(os.homedir());
    if (value !== home && !value.startsWith(home + path.sep)) return fail(request.action, 'Screenshot output must stay inside the user home directory.');
    await fs.mkdir(path.dirname(value), { recursive: true });
    const ps = `$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Windows.Forms;Add-Type -AssemblyName System.Drawing;$screen=[Windows.Forms.Screen]::PrimaryScreen;$bmp=New-Object Drawing.Bitmap $screen.Bounds.Width,$screen.Bounds.Height;$g=[Drawing.Graphics]::FromImage($bmp);$g.CopyFromScreen($screen.Bounds.Location,[Drawing.Point]::Empty,$screen.Bounds.Size);$bmp.Save($args[0],[Drawing.Imaging.ImageFormat]::Png);$g.Dispose();$bmp.Dispose();Write-Output $args[0]`;
    const result = await this.runner.run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps, value]);
    if (!result.ok) { this.logger.error('Screenshot capture failed', { stderr: result.stderr }); return fail(request.action, `I could not capture the screen. ${result.stderr || result.stdout || ''}`.trim()); }
    return ok(request.action, result.simulated ? `Screenshot prepared at ${value} (simulated).` : `Screenshot saved to ${value}.`, { path: value, simulated: result.simulated });
  }
  healthCheck(): ModuleStatus { return 'running'; }
}
