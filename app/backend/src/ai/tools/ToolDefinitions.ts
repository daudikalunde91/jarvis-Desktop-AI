import type { AIToolDefinition } from '@backend/ai/types';

export interface ToolMapping {
  readonly definition: AIToolDefinition;
  readonly agentAction: string;
}

/**
 * Tool catalogue exposed to reasoning models. Keep this list explicit and
 * permission-aware: the model may request a tool, but the ToolRegistry and
 * PermissionManager remain the only execution gate.
 */
export const AI_TOOL_MAPPINGS: readonly ToolMapping[] = [
  {
    agentAction: 'system.info',
    definition: {
      name: 'system.get_info',
      description: 'Read detailed live information about this computer: OS, CPU, RAM, uptime, disk space and process pressure.',
      parameters: { type: 'object', properties: {} },
      minRole: 'guest',
      requiresConfirmation: false,
    },
  },
  {
    agentAction: 'system.diagnose',
    definition: {
      name: 'system.diagnose',
      description: 'Diagnose common Windows PC health issues using live system telemetry and return observations and recommendations.',
      parameters: {
        type: 'object',
        properties: { concern: { type: 'string', description: 'Optional concern such as overheating, slow PC, battery, disk, RAM or general health.' } },
      },
      minRole: 'guest',
      requiresConfirmation: false,
    },
  },
  {
    agentAction: 'system.time',
    definition: {
      name: 'system.get_time',
      description: 'Get the current local date and time.',
      parameters: { type: 'object', properties: {} },
      minRole: 'guest',
      requiresConfirmation: false,
    },
  },
  {
    agentAction: 'app.discover',
    definition: {
      name: 'apps.discover',
      description: 'Discover applications currently available to launch on Windows instead of relying on a fixed app list.',
      parameters: { type: 'object', properties: {} },
      minRole: 'user',
      requiresConfirmation: false,
    },
  },
  {
    agentAction: 'app.open',
    definition: {
      name: 'app.open',
      description: 'Open an installed application by name. JARVIS may discover the application first if it is not in the cached app list.',
      parameters: { type: 'object', properties: { app: { type: 'string', description: 'Application name' } }, required: ['app'] },
      minRole: 'user',
      requiresConfirmation: false,
    },
  },
  {
    agentAction: 'app.close',
    definition: {
      name: 'app.close',
      description: 'Close a running desktop application by friendly name.',
      parameters: { type: 'object', properties: { app: { type: 'string', description: 'Application name' } }, required: ['app'] },
      minRole: 'user',
      requiresConfirmation: false,
    },
  },
  {
    agentAction: 'file.list',
    definition: {
      name: 'files.list',
      description: 'List files and folders in a directory.',
      parameters: { type: 'object', properties: { path: { type: 'string', description: 'Directory path' } }, required: ['path'] },
      minRole: 'user',
      requiresConfirmation: false,
    },
  },
  {
    agentAction: 'file.search',
    definition: {
      name: 'files.search',
      description: 'Search for files by name pattern.',
      parameters: { type: 'object', properties: { query: { type: 'string' }, path: { type: 'string' } }, required: ['query'] },
      minRole: 'user',
      requiresConfirmation: false,
    },
  },
  {
    agentAction: 'file.read',
    definition: {
      name: 'files.read',
      description: 'Read a text file and return its contents, truncated safely when very large.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      minRole: 'user',
      requiresConfirmation: false,
    },
  },
  {
    agentAction: 'file.create',
    definition: {
      name: 'files.create',
      description: 'Create or overwrite a text file in an allowed user directory.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
      minRole: 'user',
      requiresConfirmation: true,
    },
  },
  {
    agentAction: 'file.createFolder',
    definition: {
      name: 'files.create_folder',
      description: 'Create a folder in an allowed user directory.',
      parameters: { type: 'object', properties: { name: { type: 'string' }, parent: { type: 'string' } }, required: ['name'] },
      minRole: 'user',
      requiresConfirmation: true,
    },
  },
  {
    agentAction: 'file.rename',
    definition: {
      name: 'files.rename',
      description: 'Rename a file or folder.',
      parameters: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'] },
      minRole: 'user',
      requiresConfirmation: true,
    },
  },
  {
    agentAction: 'file.move',
    definition: {
      name: 'files.move',
      description: 'Move a file or folder.',
      parameters: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'] },
      minRole: 'user',
      requiresConfirmation: true,
    },
  },
  {
    agentAction: 'file.copy',
    definition: {
      name: 'files.copy',
      description: 'Copy a file or folder.',
      parameters: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'] },
      minRole: 'user',
      requiresConfirmation: true,
    },
  },
  {
    agentAction: 'file.open',
    definition: {
      name: 'files.open',
      description: 'Open a file with the associated Windows application.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      minRole: 'user',
      requiresConfirmation: false,
    },
  },
  {
    agentAction: 'browser.open',
    definition: {
      name: 'browser.open',
      description: 'Open a URL or known site in the default browser.',
      parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
      minRole: 'user',
      requiresConfirmation: false,
    },
  },
  {
    agentAction: 'browser.search',
    definition: {
      name: 'browser.search',
      description: 'Open a web search for a query.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      minRole: 'user',
      requiresConfirmation: false,
    },
  },
  {
    agentAction: 'office.word.create',
    definition: {
      name: 'office.create_word_document',
      description: 'Create a Microsoft Word document with supplied text and save it to an allowed user path. Requires Microsoft Word on Windows.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
      minRole: 'user',
      requiresConfirmation: true,
    },
  },
  {
    agentAction: 'office.ppt.create',
    definition: {
      name: 'office.create_powerpoint',
      description: 'Create a Microsoft PowerPoint presentation with a title and slide outline, then save it to an allowed user path. Requires Microsoft PowerPoint on Windows.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, title: { type: 'string' }, slides: { type: 'array', items: { type: 'object' } } }, required: ['path', 'slides'] },
      minRole: 'user',
      requiresConfirmation: true,
    },
  },
  {
    agentAction: 'vision.capture',
    definition: {
      name: 'screen.capture',
      description: 'Capture the current primary screen to a JARVIS-managed image file for inspection or sharing.',
      parameters: { type: 'object', properties: { outputPath: { type: 'string' } } },
      minRole: 'user',
      requiresConfirmation: true,
    },
  },
  {
    agentAction: 'system.shutdown',
    definition: {
      name: 'system.shutdown',
      description: 'Shut down the computer. Destructive — requires explicit user confirmation.',
      parameters: { type: 'object', properties: {} },
      minRole: 'admin',
      requiresConfirmation: true,
    },
  },
  {
    agentAction: 'coding.runCommand',
    definition: {
      name: 'terminal.execute',
      description: 'Run an allow-listed shell command inside the project workspace.',
      parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
      minRole: 'admin',
      requiresConfirmation: true,
    },
  },
  {
    agentAction: 'coding.inspectProject',
    definition: {
      name: 'vscode.inspect_project',
      description: 'Inspect the JARVIS project structure.',
      parameters: { type: 'object', properties: {} },
      minRole: 'user',
      requiresConfirmation: false,
    },
  },

  // ---- Personal integrations (Stage 7). Execution is gated by PermissionManager + capability grants. ----
  {
    agentAction: 'gmail.search',
    definition: {
      name: 'gmail.search',
      description: 'Search the user\'s connected Gmail. Uses Gmail query syntax (e.g. "from:john subject:internship"). Returns sender, subject, date and snippet. Fails with an authorization message if Gmail is not connected — never invent results.',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'Gmail search query.' }, maxResults: { type: 'number', description: 'Max results (1-15).' } }, required: ['query'] },
      minRole: 'user',
      requiresConfirmation: false,
    },
  },
  {
    agentAction: 'gmail.read',
    definition: {
      name: 'gmail.read',
      description: 'Read one Gmail message by its messageId (from gmail.search).',
      parameters: { type: 'object', properties: { messageId: { type: 'string' } }, required: ['messageId'] },
      minRole: 'user',
      requiresConfirmation: false,
    },
  },
  {
    agentAction: 'gmail.send',
    definition: {
      name: 'gmail.send',
      description: 'Send an email from the user\'s Gmail. Requires explicit user confirmation before it runs. Only use after the recipient address, subject and body are known.',
      parameters: { type: 'object', properties: { to: { type: 'string', description: 'Single recipient email address.' }, subject: { type: 'string' }, body: { type: 'string' } }, required: ['to', 'subject', 'body'] },
      minRole: 'user',
      requiresConfirmation: true,
    },
  },
  {
    agentAction: 'calendar.list_events',
    definition: {
      name: 'calendar.list_events',
      description: 'List events from the user\'s Google Calendar between timeMin and timeMax (ISO 8601). Defaults to the next 7 days.',
      parameters: { type: 'object', properties: { timeMin: { type: 'string' }, timeMax: { type: 'string' }, maxResults: { type: 'number' } } },
      minRole: 'user',
      requiresConfirmation: false,
    },
  },
  {
    agentAction: 'calendar.search_events',
    definition: {
      name: 'calendar.search_events',
      description: 'Search Google Calendar events by text within an optional ISO 8601 time range.',
      parameters: { type: 'object', properties: { query: { type: 'string' }, timeMin: { type: 'string' }, timeMax: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query'] },
      minRole: 'user',
      requiresConfirmation: false,
    },
  },
  {
    agentAction: 'calendar.create_event',
    definition: {
      name: 'calendar.create_event',
      description: 'Create a Google Calendar event. Requires user confirmation. start/end are ISO 8601 date-times.',
      parameters: { type: 'object', properties: { summary: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, timeZone: { type: 'string' }, description: { type: 'string' }, location: { type: 'string' } }, required: ['summary', 'start', 'end'] },
      minRole: 'user',
      requiresConfirmation: true,
    },
  },
  {
    agentAction: 'calendar.update_event',
    definition: {
      name: 'calendar.update_event',
      description: 'Update fields of an existing Google Calendar event by eventId. Requires user confirmation.',
      parameters: { type: 'object', properties: { eventId: { type: 'string' }, summary: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, timeZone: { type: 'string' }, description: { type: 'string' }, location: { type: 'string' } }, required: ['eventId'] },
      minRole: 'user',
      requiresConfirmation: true,
    },
  },
  {
    agentAction: 'calendar.delete_event',
    definition: {
      name: 'calendar.delete_event',
      description: 'Delete a Google Calendar event by eventId. Destructive: requires user confirmation.',
      parameters: { type: 'object', properties: { eventId: { type: 'string' } }, required: ['eventId'] },
      minRole: 'user',
      requiresConfirmation: true,
    },
  },
];
