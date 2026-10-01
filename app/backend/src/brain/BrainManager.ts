import type { ILogger } from '@backend/logging/ILogger';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { IHealthCheckable } from '@backend/shared/interfaces/IHealthCheckable';
import type { PermissionRole } from '@backend/security/types/SecurityTypes';
import type { MemoryManager } from '@backend/memory/MemoryManager';
import { RulesEngine } from '@backend/brain/RulesEngine';
import { TaskPlanner } from '@backend/brain/TaskPlanner';
import type { ActionExecutor } from '@backend/brain/ActionExecutor';
import { NullCloudReasoner, ToolConfirmationRequiredError, type ICloudReasoner } from '@backend/brain/CloudReasoner';
import { AllProvidersFailedError } from '@backend/ai/errors';
import type { BrainResponse, BrainSource, PlanExecution, TaskPlan } from '@backend/brain/types';

export interface BrainRequest {
  readonly sessionId: string;
  readonly utterance: string;
  readonly role?: PermissionRole;
  /** Set when the user is answering "yes" to a pending confirmation. */
  readonly confirmed?: boolean;
}

const SYSTEM_PROMPT = [
  'You are JARVIS, an intelligent personal Windows desktop agent.',
  "Reply in the user's language (English or Swahili) unless they ask otherwise.",
  'Use a natural, helpful level of detail. Do not force one- or two-sentence answers.',
  'For troubleshooting, explain likely causes, evidence, practical steps, warnings, and recommendations.',
  'When a computer action can solve the request, use the available tools instead of merely describing how to do it.',
  'Never claim an action succeeded unless a tool result confirms it.',
  'For risky actions, respect JARVIS permissions and ask for confirmation when required.',
  'Use a few relevant emojis when they improve readability, but do not overuse them.',
].join(' ');

/**
 * The Brain (Milestone 5) — the single entry point between voice/text
 * input and everything JARVIS can do.
 *
 * Order of resolution, by design:
 *   1. Rules Engine (offline, instant, private)
 *   2. Task Planner + Action Executor (permission-gated)
 *   3. Cloud reasoner, only for unmatched conversation and only if enabled
 */
export class BrainManager implements IHealthCheckable {
  private readonly pending = new Map<string, TaskPlan>();
  private readonly pendingTools = new Map<string, ToolConfirmationRequiredError>();

  constructor(
    private readonly logger: ILogger,
    private readonly rules: RulesEngine,
    private readonly planner: TaskPlanner,
    private readonly executor: ActionExecutor,
    private readonly memory: MemoryManager,
    private readonly cloud: ICloudReasoner = new NullCloudReasoner(),
  ) {}

  hasPendingConfirmation(sessionId: string): boolean {
    return this.pending.has(sessionId) || this.pendingTools.has(sessionId);
  }

  cancelPending(sessionId: string): void {
    this.pending.delete(sessionId);
    this.pendingTools.delete(sessionId);
  }

  async handle(request: BrainRequest): Promise<BrainResponse> {
    const utterance = request.utterance.trim();
    this.memory.recordTurn(request.sessionId, 'user', utterance);

    // 1. Is the user answering a pending tool/action confirmation?
    const awaitingTool = this.pendingTools.get(request.sessionId);
    if (awaitingTool) {
      const answer = this.readConfirmation(utterance);
      if (answer === 'yes') {
        this.pendingTools.delete(request.sessionId);
        const cloudWithTools = this.cloud as ICloudReasoner & { executeConfirmedTool?: (call: import('@backend/ai/types').AIToolCall, sessionId: string, role: PermissionRole) => Promise<string> };
        if (cloudWithTools.executeConfirmedTool) {
          const result = await cloudWithTools.executeConfirmedTool(awaitingTool.toolCall, request.sessionId, request.role ?? awaitingTool.role);
          const intent = this.rules.parse(utterance);
          return this.reply(request, result, intent, 'cloud', null, null);
        }
      }
      if (answer === 'no') {
        this.pendingTools.delete(request.sessionId);
        const intent = this.rules.parse(utterance);
        const reply = intent.language === 'sw' ? 'Sawa, nimeacha.' : 'Understood, I have cancelled that action.';
        return this.reply(request, reply, intent, 'rules', null, null);
      }
    }

    // 2. Is the user answering a pending "are you sure?"
    const awaiting = this.pending.get(request.sessionId);
    if (awaiting) {
      const answer = this.readConfirmation(utterance);
      if (answer === 'yes') {
        this.pending.delete(request.sessionId);
        return this.runPlan(request, awaiting, this.rules.parse(utterance), true);
      }
      if (answer === 'no') {
        this.pending.delete(request.sessionId);
        const intent = this.rules.parse(utterance);
        const reply = intent.language === 'sw' ? 'Sawa, nimeacha.' : 'Understood, I have cancelled that.';
        return this.reply(request, reply, intent, 'rules', awaiting, null);
      }
    }

    // 2. Offline rules.
    const intent = this.rules.parse(utterance);
    const plan = this.planner.plan(intent);

    if (plan.steps.length > 0) {
      return this.runPlan(request, plan, intent, request.confirmed === true);
    }

    if (plan.reply) {
      return this.reply(request, plan.reply, intent, 'rules', plan, null);
    }

    // 3. Cloud fallback for open conversation only.
    if (this.cloud.isAvailable()) {
      try {
        const history = this.memory.getShortTerm(request.sessionId).map((turn) => ({
          role: turn.role,
          content: turn.text,
        }));
        const answer = await this.cloud.complete({
          sessionId: request.sessionId,
          role: request.role ?? 'user',
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
          tools: undefined,
        });
        return this.reply(request, answer, intent, 'cloud', null, null);
      } catch (error) {
        if (error instanceof ToolConfirmationRequiredError) {
          this.pendingTools.set(request.sessionId, error);
          const message = intent.language === 'sw'
            ? `Nahitaji uthibitisho wako kabla sijafanya hilo. ${error.message} \nAndika "ndiyo" kuendelea au "hapana" kuacha.`
            : `${error.message} Please confirm by saying "yes" or cancel with "no".`;
          return this.reply(request, message, intent, 'cloud', null, null);
        }
        if (error instanceof AllProvidersFailedError) {
          const failures = error.attempts.map((attempt) => `${attempt.providerId}: ${attempt.code}`).join(', ');
          const message = intent.language === 'sw'
            ? `Huduma za AI hazikupatikana kwa sasa. ${failures}. Angalia quota/API key ya provider aliye na tatizo au weka provider mwingine (Gemini/Claude) ili failover ifanye kazi.`
            : `Cloud AI providers were unavailable: ${failures}. Check the affected provider's quota/API key or configure another provider so failover can continue.`;
          return this.reply(request, message, intent, 'cloud', null, null);
        }
        // Fall through to the offline apology below.
      }
    }

    const fallback =
      intent.language === 'sw'
        ? 'Samahani, sijaelewa hilo. Unaweza kuniambia kwa njia nyingine?'
        : "I'm not sure how to help with that yet. Could you say it another way?";
    return this.reply(request, fallback, intent, 'rules', null, null);
  }

  private async runPlan(
    request: BrainRequest,
    plan: TaskPlan,
    intent: ReturnType<RulesEngine['parse']>,
    confirmed: boolean,
  ): Promise<BrainResponse> {
    const execution = await this.executor.execute(plan, {
      sessionId: request.sessionId,
      role: request.role,
      confirmed,
    });

    if (execution.pendingConfirmation) {
      this.pending.set(request.sessionId, plan);
      return this.reply(
        request,
        execution.pendingConfirmation.message,
        intent,
        'rules',
        plan,
        execution,
      );
    }

    this.pending.delete(request.sessionId);
    const spoken = execution.outcomes
      .filter((outcome) => outcome.status !== 'skipped')
      .map((outcome) => outcome.message)
      .join(' ');

    return this.reply(request, spoken || plan.summary, intent, 'rules', plan, execution);
  }

  private reply(
    request: BrainRequest,
    text: string,
    intent: ReturnType<RulesEngine['parse']>,
    source: BrainSource,
    plan: TaskPlan | null,
    execution: PlanExecution | null,
  ): BrainResponse {
    this.memory.recordTurn(request.sessionId, 'assistant', text);
    this.logger.debug('Brain response', { intent: intent.name, source });
    return {
      sessionId: request.sessionId,
      utterance: request.utterance,
      reply: text,
      intent,
      source,
      plan,
      execution,
    };
  }

  private readConfirmation(utterance: string): 'yes' | 'no' | 'unclear' {
    const text = utterance.trim().toLowerCase();
    if (/^(yes|yeah|yep|sure|do it|go ahead|confirm|ndio|ndiyo|sawa|endelea)\b/.test(text)) return 'yes';
    if (/^(no|nope|cancel|stop|don'?t|hapana|acha|sitisha)\b/.test(text)) return 'no';
    return 'unclear';
  }

  healthCheck(): ModuleStatus {
    return this.executor.healthCheck();
  }
}
