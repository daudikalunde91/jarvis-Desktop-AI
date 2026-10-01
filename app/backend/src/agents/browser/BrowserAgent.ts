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

/** Spoken site names -> URLs, so "open GitHub" works without a URL. */
export const KNOWN_SITES: Record<string, string> = {
  github: 'https://github.com',
  google: 'https://www.google.com',
  youtube: 'https://www.youtube.com',
  gmail: 'https://mail.google.com',
  stackoverflow: 'https://stackoverflow.com',
  chatgpt: 'https://chat.openai.com',
  whatsapp: 'https://web.whatsapp.com',
  facebook: 'https://www.facebook.com',
  x: 'https://x.com',
  twitter: 'https://x.com',
};

export interface BrowserAgentOptions {
  searchUrlTemplate?: string;
  defaultBrowser?: string | null;
}

/**
 * Browser Agent (Milestone 6). Deliberately a separate module from the
 * core brain: it only knows how to turn a URL or a query into an
 * operating-system "open" command.
 */
export class BrowserAgent implements IActionAgent {
  public readonly id = 'browser-agent';
  public readonly actions = ['browser.open', 'browser.search'] as const;

  private readonly searchUrlTemplate: string;
  private readonly defaultBrowser: string | null;

  constructor(
    private readonly logger: ILogger,
    private readonly runner: ICommandRunner,
    options: BrowserAgentOptions = {},
  ) {
    this.searchUrlTemplate =
      options.searchUrlTemplate ?? 'https://www.google.com/search?q={query}';
    this.defaultBrowser = options.defaultBrowser ?? null;
  }

  normalizeUrl(input: string): string {
    const key = input.trim().toLowerCase().replace(/\.com$/, '');
    if (KNOWN_SITES[key]) return KNOWN_SITES[key] as string;
    if (/^https?:\/\//i.test(input)) return input.trim();
    if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(input.trim())) return `https://${input.trim()}`;
    return this.searchUrlTemplate.replace('{query}', encodeURIComponent(input.trim()));
  }

  async execute(request: ActionRequest): Promise<ActionResult> {
    switch (request.action) {
      case 'browser.open': {
        const target = requiredString(request.params, 'url') ?? requiredString(request.params, 'site');
        if (!target) return fail('browser.open', 'No website was provided.');
        return this.launch('browser.open', this.normalizeUrl(target), `Opening ${target}.`);
      }
      case 'browser.search': {
        const query = requiredString(request.params, 'query');
        if (!query) return fail('browser.search', 'No search query was provided.');
        const url = this.searchUrlTemplate.replace('{query}', encodeURIComponent(query));
        return this.launch('browser.search', url, `Searching the web for ${query}.`);
      }
      default:
        return fail(request.action, `BrowserAgent cannot handle action "${request.action}"`);
    }
  }

  private async launch(action: string, url: string, message: string): Promise<ActionResult> {
    const args = this.defaultBrowser
      ? ['/c', 'start', '', this.defaultBrowser, url]
      : ['/c', 'start', '', url];
    const result = await this.runner.run('cmd.exe', args);
    if (!result.ok) {
      this.logger.error(`Browser action failed: ${action}`, { url, stderr: result.stderr });
      return fail(action, `I could not open the browser for ${url}.`);
    }
    return ok(action, message, { url, simulated: result.simulated });
  }

  healthCheck(): ModuleStatus {
    return 'running';
  }
}
