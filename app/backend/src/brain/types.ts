import type { RiskLevel } from '@backend/security/types/SecurityTypes';

/** Every intent the offline Rules Engine can recognize without cloud AI. */
export const INTENT_NAMES = [
  'greeting',
  'farewell',
  'thanks',
  'identity',
  'help',
  'time_query',
  'system_info',
  'system_diagnose',
  'system_shutdown',
  'system_restart',
  'system_sleep',
  'system_lock',
  'app_open',
  'app_close',
  'file_search',
  'file_list',
  'file_create_folder',
  'file_create',
  'file_rename',
  'file_move',
  'file_copy',
  'file_open',
  'office_word_create',
  'office_ppt_create',
  'screen_capture',
  'browser_open',
  'web_search',
  'coding_inspect',
  'memory_remember',
  'memory_recall',
  'memory_forget',
  'prepare_dev_environment',
  'unknown',
] as const;

export type IntentName = (typeof INTENT_NAMES)[number];

export type Language = 'en' | 'sw';

export interface ParsedIntent {
  readonly name: IntentName;
  readonly confidence: number;
  readonly language: Language;
  readonly entities: Record<string, string>;
  readonly utterance: string;
}

export interface TaskStep {
  readonly id: string;
  readonly description: string;
  /** Null for conversational steps that need no agent action. */
  readonly action: string | null;
  readonly params: Record<string, unknown>;
  readonly risk: RiskLevel;
}

export interface TaskPlan {
  readonly id: string;
  readonly intent: IntentName;
  readonly summary: string;
  readonly steps: readonly TaskStep[];
  /** Spoken reply used when the plan has no agent actions. */
  readonly reply: string | null;
}

export type StepStatus = 'completed' | 'failed' | 'denied' | 'awaiting-confirmation' | 'skipped';

export interface StepOutcome {
  readonly stepId: string;
  readonly action: string | null;
  readonly status: StepStatus;
  readonly message: string;
  readonly risk: RiskLevel;
  readonly data?: unknown;
}

export interface PlanExecution {
  readonly planId: string;
  readonly outcomes: readonly StepOutcome[];
  readonly completed: boolean;
  /** Set when execution stopped because the user must confirm something. */
  readonly pendingConfirmation: StepOutcome | null;
}

export type BrainSource = 'rules' | 'cloud' | 'memory';

export interface BrainResponse {
  readonly sessionId: string;
  readonly utterance: string;
  readonly reply: string;
  readonly intent: ParsedIntent;
  readonly source: BrainSource;
  readonly plan: TaskPlan | null;
  readonly execution: PlanExecution | null;
}
