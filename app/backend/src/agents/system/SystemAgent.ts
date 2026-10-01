import os from 'node:os';

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

export const KNOWN_APPLICATIONS: Record<string, string> = {
  chrome: 'chrome',
  edge: 'msedge',
  firefox: 'firefox',
  notepad: 'notepad',
  calculator: 'calc',
  explorer: 'explorer',
  'file explorer': 'explorer',
  vscode: 'code',
  'visual studio code': 'code',
  terminal: 'wt',
  cmd: 'cmd',
  powershell: 'powershell',
  word: 'winword',
  excel: 'excel',
  spotify: 'spotify',
  settings: 'ms-settings:',
};

interface DiscoveredApp { name: string; appId: string; }

function normalizeAppName(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeDiscoveredApp(value: unknown): DiscoveredApp | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const name = typeof record.Name === 'string' ? record.Name.trim() : typeof record.name === 'string' ? record.name.trim() : '';
  const appId = typeof record.AppID === 'string' ? record.AppID.trim() : typeof record.appId === 'string' ? record.appId.trim() : '';
  if (!name || !appId) return null;
  return { name, appId };
}

/** Windows system + application awareness agent. */
export class SystemAgent implements IActionAgent {
  public readonly id = 'system-agent';
  public readonly actions = [
    'system.info', 'system.diagnose', 'system.time', 'system.lock', 'system.sleep',
    'system.restart', 'system.shutdown', 'app.discover', 'app.open', 'app.close',
  ] as const;
  private discovered: DiscoveredApp[] = [];

  constructor(private readonly logger: ILogger, private readonly runner: ICommandRunner) {}

  async execute(request: ActionRequest): Promise<ActionResult> {
    switch (request.action) {
      case 'system.info': return this.systemInfo();
      case 'system.diagnose': return this.diagnose(request);
      case 'system.time': return this.currentTime();
      case 'system.lock': return this.simple('system.lock', 'rundll32.exe', ['user32.dll,LockWorkStation'], 'Computer locked.');
      case 'system.sleep': return this.simple('system.sleep', 'rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0'], 'Putting the computer to sleep.');
      case 'system.restart': return this.simple('system.restart', 'shutdown.exe', ['/r', '/t', '5'], 'Restarting the computer.');
      case 'system.shutdown': return this.simple('system.shutdown', 'shutdown.exe', ['/s', '/t', '5'], 'Shutting the computer down.');
      case 'app.discover': return this.discoverApps();
      case 'app.open': return this.openApp(request);
      case 'app.close': return this.closeApp(request);
      default: return fail(request.action, `SystemAgent cannot handle action "${request.action}"`);
    }
  }

  private async currentTime(): Promise<ActionResult> {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return ok('system.time', `It is ${time} on ${date}.`, { iso: now.toISOString(), time, date });
  }

  private async systemInfo(): Promise<ActionResult> {
    const totalGb = os.totalmem() / 1024 ** 3;
    const freeGb = os.freemem() / 1024 ** 3;
    const disk = await this.runPowerShellJson<Array<{ DeviceID: string; Size?: number; FreeSpace?: number }>>(`Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,Size,FreeSpace | ConvertTo-Json -Compress`);
    const processes = await this.runPowerShellJson<Array<{ Name: string; CPU?: number }>>(`Get-Process | Sort-Object CPU -Descending | Select-Object -First 8 Name,CPU | ConvertTo-Json -Compress`);
    const diskList = Array.isArray(disk) ? disk : disk ? [disk] : [];
    const topProcesses = Array.isArray(processes) ? processes : processes ? [processes] : [];
    const data = {
      platform: os.platform(),
      release: os.release(),
      hostname: os.hostname(),
      cpuModel: os.cpus()[0]?.model ?? 'unknown',
      cpuCores: os.cpus().length,
      totalMemoryGb: Number(totalGb.toFixed(2)),
      freeMemoryGb: Number(freeGb.toFixed(2)),
      memoryUsedPercent: Number((((totalGb - freeGb) / totalGb) * 100).toFixed(1)),
      uptimeHours: Number((os.uptime() / 3600).toFixed(2)),
      disks: diskList.map((d) => ({ drive: d.DeviceID, totalGb: d.Size ? Number((d.Size / 1024 ** 3).toFixed(2)) : null, freeGb: d.FreeSpace ? Number((d.FreeSpace / 1024 ** 3).toFixed(2)) : null, usedPercent: d.Size && d.FreeSpace ? Number(((1 - d.FreeSpace / d.Size) * 100).toFixed(1)) : null })),
      topProcesses,
    };
    return ok('system.info', this.summary(data), data);
  }

  private summary(data: { cpuCores: number; freeMemoryGb: number; totalMemoryGb: number; memoryUsedPercent: number; disks: Array<{ drive: string; usedPercent: number | null }>; topProcesses: Array<{ Name: string; CPU?: number }> }): string {
    const drive = data.disks.find((d) => d.drive?.toUpperCase() === 'C:');
    const diskPart = drive?.usedPercent != null ? ` C: is ${drive.usedPercent}% used.` : '';
    const processPart = data.topProcesses[0]?.Name ? ` Top CPU process observed: ${data.topProcesses[0].Name}.` : '';
    return `${data.cpuCores} CPU cores, ${data.freeMemoryGb} GB of ${data.totalMemoryGb} GB RAM free (${data.memoryUsedPercent}% used).${diskPart}${processPart}`;
  }

  private async diagnose(request: ActionRequest): Promise<ActionResult> {
    const concern = (requiredString(request.params, 'concern') ?? 'general').toLowerCase();
    const info = await this.systemInfo();
    const data = info.data as { memoryUsedPercent: number; disks: Array<{ drive: string; usedPercent: number | null }>; topProcesses: Array<{ Name: string; CPU?: number }>; };
    const cpu = await this.runPowerShellJson<Array<{ LoadPercentage?: number }>>(`Get-CimInstance Win32_Processor | Select-Object LoadPercentage | ConvertTo-Json -Compress`);
    const battery = await this.runPowerShellJson<Array<{ EstimatedChargeRemaining?: number; BatteryStatus?: number }>>(`Get-CimInstance Win32_Battery | Select-Object EstimatedChargeRemaining,BatteryStatus | ConvertTo-Json -Compress`);
    const thermals = await this.runPowerShellJson<Array<{ CurrentTemperature?: number }>>(`Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | Select-Object CurrentTemperature | ConvertTo-Json -Compress`);
    const cpuList = Array.isArray(cpu) ? cpu : cpu ? [cpu] : [];
    const batteryList = Array.isArray(battery) ? battery : battery ? [battery] : [];
    const thermalList = Array.isArray(thermals) ? thermals : thermals ? [thermals] : [];
    const avgCpu = cpuList.length ? Math.round(cpuList.reduce((sum, c) => sum + Number(c.LoadPercentage ?? 0), 0) / cpuList.length) : null;
    const thermalC = thermalList.map((t) => Number(t.CurrentTemperature ?? 0) / 10 - 273.15).filter((v) => Number.isFinite(v) && v > 0 && v < 130);
    const cDrive = data.disks.find((d) => d.drive?.toUpperCase() === 'C:');
    const findings: string[] = [];
    const recommendations: string[] = [];
    if (avgCpu !== null && avgCpu >= 85) { findings.push(`CPU load is high at about ${avgCpu}%.`); recommendations.push('Check the top CPU-consuming processes, close unnecessary applications, and allow the machine to cool before heavy work.'); }
    if (data.memoryUsedPercent >= 85) { findings.push(`RAM usage is high at ${data.memoryUsedPercent}%.`); recommendations.push('Close memory-heavy applications and inspect startup/background programs.'); }
    if (cDrive?.usedPercent != null && cDrive.usedPercent >= 90) { findings.push(`The C: drive is ${cDrive.usedPercent}% full.`); recommendations.push('Free disk space by removing temporary files and moving large personal files; keep a safety margin for Windows.'); }
    if (thermalC.length) findings.push(`Windows reported thermal sensor readings around ${Math.round(Math.max(...thermalC))}°C.`); else findings.push('Windows did not expose a reliable hardware temperature sensor through the standard interface, so temperature cannot be confirmed from software telemetry alone.');
    if (batteryList[0]?.EstimatedChargeRemaining != null) findings.push(`Battery charge is ${batteryList[0].EstimatedChargeRemaining}%.`);
    if (!findings.length) findings.push('No major software-level pressure was detected from the telemetry available to JARVIS.');
    if (concern.includes('heat') || concern.includes('joto') || concern.includes('overheat')) recommendations.push('Check that air vents are unobstructed, use the PC on a hard surface, clean dust from vents/fans, and consider professional thermal-paste/fan service if temperatures remain high.');
    if (!recommendations.length) recommendations.push('I can inspect a specific area next, such as CPU, memory, disk, battery, startup applications, or running processes.');
    const detail = `${findings.join(' ')} Recommendations: ${recommendations.join(' ')}`;
    return ok('system.diagnose', detail, { concern, findings, recommendations, cpuLoadPercent: avgCpu, thermalC, topProcesses: data.topProcesses, memoryUsedPercent: data.memoryUsedPercent, disks: data.disks });
  }

  private async discoverApps(): Promise<ActionResult> {
    const result = await this.runner.run('powershell.exe', ['-NoProfile', '-Command', `Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress`]);
    if (!result.ok || !result.stdout.trim()) return fail('app.discover', `I could not read the Windows application catalog. ${result.stderr || ''}`.trim());
    try {
      const parsed = JSON.parse(result.stdout) as unknown;
      const rawItems = Array.isArray(parsed) ? parsed : [parsed];
      this.discovered = rawItems.map(normalizeDiscoveredApp).filter((app): app is DiscoveredApp => app !== null);
      const unique = this.discovered.filter((app, index, list) => list.findIndex((x) => normalizeAppName(x.name) === normalizeAppName(app.name)) === index).slice(0, 200);
      return ok('app.discover', `I discovered ${unique.length} applications available from the Windows Start catalog.`, unique);
    } catch (error) {
      this.logger.warn('Could not parse app discovery output', { message: error instanceof Error ? error.message : String(error) });
      return fail('app.discover', 'Windows returned application data in an unexpected format.');
    }
  }

  private async openApp(request: ActionRequest): Promise<ActionResult> {
    const name = requiredString(request.params, 'app');
    if (!name) return fail('app.open', 'No application name was provided.');
    const key = normalizeAppName(name);
    if (!this.discovered.length) await this.discoverApps();
    const discovered = this.discovered.find((app) => {
      const appName = normalizeAppName(app.name);
      return appName === key || appName.includes(key);
    });
    if (discovered) {
      const result = await this.runner.run('explorer.exe', [`shell:AppsFolder\\${discovered.appId}`]);
      if (result.ok) return ok('app.open', `Opening ${discovered.name}.`, { name: discovered.name, appId: discovered.appId, simulated: result.simulated });
    }
    const executable = KNOWN_APPLICATIONS[key];
    if (!executable) return fail('app.open', `I could not find an installed application matching "${name}". Try app discovery or give me its exact name.`);
    const result = await this.runner.run('cmd.exe', ['/c', 'start', '', executable]);
    if (!result.ok) return fail('app.open', `I could not open ${name}.`);
    return ok('app.open', `Opening ${name}.`, { executable, simulated: result.simulated });
  }

  private async closeApp(request: ActionRequest): Promise<ActionResult> {
    const name = requiredString(request.params, 'app');
    if (!name) return fail('app.close', 'No application name was provided.');
    const executable = KNOWN_APPLICATIONS[normalizeAppName(name)];
    if (!executable || executable.endsWith(':')) return fail('app.close', `I do not have a safe close profile for "${name}" yet.`);
    const result = await this.runner.run('taskkill.exe', ['/IM', `${executable}.exe`, '/F']);
    if (!result.ok) return fail('app.close', `I could not close ${name}.`);
    return ok('app.close', `Closing ${name}.`, { executable, simulated: result.simulated });
  }

  private async simple(action: string, command: string, args: string[], successMessage: string): Promise<ActionResult> {
    const result = await this.runner.run(command, args);
    if (!result.ok) { this.logger.error(`System action failed: ${action}`, { stderr: result.stderr }); return fail(action, `Could not complete ${action}: ${result.stderr || 'unknown error'}`); }
    return ok(action, result.simulated ? `${successMessage} (simulated)` : successMessage, { simulated: result.simulated });
  }

  private async runPowerShellJson<T>(script: string): Promise<T | null> {
    if (process.platform !== 'win32') return null;
    const result = await this.runner.run('powershell.exe', ['-NoProfile', '-Command', script]);
    if (!result.ok || !result.stdout.trim()) return null;
    try { return JSON.parse(result.stdout) as T; } catch { return null; }
  }

  healthCheck(): ModuleStatus { return 'running'; }
}
