import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { ILogger } from '@backend/logging/ILogger';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { ICommandRunner } from '@backend/agents/runtime/ShellCommandRunner';
import { fail, ok, requiredString, type ActionRequest, type ActionResult, type IActionAgent } from '@backend/agents/types';

export class OfficeAgent implements IActionAgent {
  public readonly id = 'office-agent';
  public readonly actions = ['office.word.create', 'office.ppt.create'] as const;

  constructor(private readonly logger: ILogger, private readonly runner: ICommandRunner) {}

  async execute(request: ActionRequest): Promise<ActionResult> {
    try {
      if (process.platform !== 'win32') return fail(request.action, 'Microsoft Office automation is currently implemented for Windows only.');
      if (request.action === 'office.word.create') return this.createWord(request);
      if (request.action === 'office.ppt.create') return this.createPowerPoint(request);
      return fail(request.action, `OfficeAgent cannot handle action "${request.action}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Office action failed: ${request.action}`, { message });
      return fail(request.action, `Office automation failed: ${message}`);
    }
  }

  private resolveUserPath(raw: string): string {
    const home = os.homedir();
    const value = raw.trim();
    if (path.isAbsolute(value)) {
      const resolved = path.resolve(value);
      if (resolved !== home && !resolved.startsWith(home + path.sep)) throw new Error('Output path must stay inside the user home directory.');
      return resolved;
    }
    return path.resolve(home, value);
  }

  private async createWord(request: ActionRequest): Promise<ActionResult> {
    const outputPath = this.resolveUserPath(requiredString(request.params, 'path') ?? 'Desktop/JARVIS-Document.docx');
    if (!outputPath.toLowerCase().endsWith('.docx')) return fail(request.action, 'The Word output path must end with .docx.');
    const content = requiredString(request.params, 'content');
    if (!content) return fail(request.action, 'No document content was provided.');
    const title = requiredString(request.params, 'title') ?? path.basename(outputPath, '.docx');
    return this.runOfficeScript('office.word.create', outputPath, { title, content }, `Created Word document ${outputPath}.`);
  }

  private async createPowerPoint(request: ActionRequest): Promise<ActionResult> {
    const outputPath = this.resolveUserPath(requiredString(request.params, 'path') ?? 'Desktop/JARVIS-Presentation.pptx');
    if (!outputPath.toLowerCase().endsWith('.pptx')) return fail(request.action, 'The PowerPoint output path must end with .pptx.');
    const title = requiredString(request.params, 'title') ?? path.basename(outputPath, '.pptx');
    const rawSlides = request.params?.['slides'];
    if (!Array.isArray(rawSlides) || rawSlides.length === 0) return fail(request.action, 'At least one slide is required.');
    return this.runOfficeScript('office.ppt.create', outputPath, { title, slides: rawSlides }, `Created PowerPoint presentation ${outputPath}.`);
  }

  private async runOfficeScript(action: string, outputPath: string, payload: Record<string, unknown>, message: string): Promise<ActionResult> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const payloadPath = path.join(os.tmpdir(), `jarvis-office-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
    await fs.writeFile(payloadPath, JSON.stringify({ outputPath, ...payload }), 'utf8');
    const script = action === 'office.word.create'
      ? `$ErrorActionPreference='Stop';$p=Get-Content -Raw -LiteralPath $args[0] | ConvertFrom-Json;$word=New-Object -ComObject Word.Application;$word.Visible=$false;$doc=$word.Documents.Add();$range=$doc.Range();$range.Text=$p.content;$doc.SaveAs2($p.outputPath,12);$doc.Close();$word.Quit();Write-Output $p.outputPath`
      : `$ErrorActionPreference='Stop';$p=Get-Content -Raw -LiteralPath $args[0] | ConvertFrom-Json;$ppt=New-Object -ComObject PowerPoint.Application;$ppt.Visible=$false;$pres=$ppt.Presentations.Add();foreach($s in @($p.slides)){$slide=$pres.Slides.Add($pres.Slides.Count+1,1);$slide.Shapes.Title.TextFrame.TextRange.Text=[string]$s.title;$body='';if($null -ne $s.content){$body=[string]$s.content};$slide.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text=$body};$pres.SaveAs($p.outputPath,24);$pres.Close();$ppt.Quit();Write-Output $p.outputPath`;
    const result = await this.runner.run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script, payloadPath]);
    await fs.rm(payloadPath, { force: true });
    if (!result.ok) return fail(action, `Could not create the Office file. ${result.stderr || result.stdout || 'Microsoft Office may not be installed.'}`);
    return ok(action, result.simulated ? `${message} (simulated)` : message, { path: outputPath, simulated: result.simulated });
  }

  healthCheck(): ModuleStatus { return 'running'; }
}
