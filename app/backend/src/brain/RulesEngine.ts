import type { ILogger } from '@backend/logging/ILogger';
import type { ModuleStatus } from '@backend/shared/types/ModuleStatus';
import type { IHealthCheckable } from '@backend/shared/interfaces/IHealthCheckable';
import type { IntentName, Language, ParsedIntent } from '@backend/brain/types';

interface RuleDefinition {
  readonly intent: IntentName;
  readonly language: Language;
  readonly patterns: readonly RegExp[];
  /** Named capture groups promoted into `entities`. */
  readonly confidence?: number;
}

/**
 * Offline intent parser (Milestone 5, "brain first, cloud last").
 *
 * Rules run before any cloud call: they are instant, free, private, and
 * cover every command in the specification in both English and Swahili.
 * Anything that does not match falls through as `unknown`, which is what
 * triggers the optional cloud fallback in `BrainManager`.
 */
const RULES: readonly RuleDefinition[] = [
  // --- Conversation ---
  { intent: 'greeting', language: 'en', patterns: [/^\s*(hi|hey|hello|good (morning|afternoon|evening))\b/i] },
  { intent: 'greeting', language: 'sw', patterns: [/^\s*(habari|mambo|shikamoo|hujambo|salama|niaje)\b/i] },
  { intent: 'farewell', language: 'en', patterns: [/\b(goodbye|bye|see you|good night)\b/i] },
  { intent: 'farewell', language: 'sw', patterns: [/\b(kwaheri|usiku mwema|tutaonana)\b/i] },
  { intent: 'thanks', language: 'en', patterns: [/\b(thanks|thank you)\b/i] },
  { intent: 'thanks', language: 'sw', patterns: [/\b(asante|ahsante)\b/i] },
  { intent: 'identity', language: 'en', patterns: [/\bwho are you\b/i, /\bwhat are you\b/i, /\byour name\b/i] },
  { intent: 'identity', language: 'sw', patterns: [/\bwewe ni nani\b/i, /\bjina lako\b/i] },
  { intent: 'help', language: 'en', patterns: [/\bwhat can you do\b/i, /^\s*help\b/i, /\byour capabilities\b/i] },
  { intent: 'help', language: 'sw', patterns: [/\bunaweza kufanya nini\b/i, /^\s*(nisaidie|msaada)\b/i] },
  { intent: 'time_query', language: 'en', patterns: [/\bwhat(?:'s| is) the time\b/i, /\bwhat time is it\b/i, /\btoday'?s date\b/i] },
  { intent: 'time_query', language: 'sw', patterns: [/\bsaa ngapi\b/i, /\bleo ni tarehe ngapi\b/i] },

  // --- System status & power ---
  { intent: 'system_info', language: 'en', patterns: [/\b(system|pc|computer) (status|info|health)\b/i, /\b(battery|cpu|ram|memory) (level|usage|status)\b/i] },
  { intent: 'system_info', language: 'sw', patterns: [/\bhali ya (mfumo|kompyuta)\b/i, /\bbetri (iko|ipo) (vipi|ngapi)\b/i] },
  { intent: 'system_diagnose', language: 'en', patterns: [/\b(why|what is wrong with|diagnose|troubleshoot|fix|check)\b.*\b(pc|computer|laptop|system|overheat|hot|slow|temperature|disk|memory|ram|cpu)\b/i] },
  { intent: 'system_diagnose', language: 'sw', patterns: [/\b(kwa nini|tatua|chunguza|kagua|kompyuta|pc|laptop)\b.*\b(joto|ina joto|polepole|tatizo|hitilafu|disk|ram|cpu|betri)\b/i] },
  { intent: 'system_diagnose', language: 'en', patterns: [/\b(my|this)\s+(pc|computer|laptop)\s+(is|feels|gets)\s+(too\s+)?(hot|slow)\b/i] },
  { intent: 'system_shutdown', language: 'en', patterns: [/\b(shut ?down|turn off|power off)\b.*\b(pc|computer|system|laptop)?\b/i] },
  { intent: 'system_shutdown', language: 'sw', patterns: [/\bzima (kompyuta|mfumo|laptop)\b/i] },
  { intent: 'system_restart', language: 'en', patterns: [/\b(restart|reboot)\b.*\b(pc|computer|system|laptop)?\b/i] },
  { intent: 'system_restart', language: 'sw', patterns: [/\b(washa upya|anzisha upya)\b/i] },
  { intent: 'system_sleep', language: 'en', patterns: [/\b(sleep|hibernate|suspend)\b.*\b(pc|computer|system|laptop)?\b/i] },
  { intent: 'system_sleep', language: 'sw', patterns: [/\bkompyuta ilale\b/i, /\blaza kompyuta\b/i] },
  { intent: 'system_lock', language: 'en', patterns: [/\block (the )?(pc|computer|screen|system)\b/i] },
  { intent: 'system_lock', language: 'sw', patterns: [/\bfunga (skrini|kompyuta)\b/i] },

  // --- Applications ---
  { intent: 'app_close', language: 'en', patterns: [/\b(close|quit|exit|kill)\s+(?<app>[\w .+-]+?)(\s+(app|application|program))?\s*$/i] },
  { intent: 'app_close', language: 'sw', patterns: [/\bfunga\s+(?<app>[\w .+-]+?)\s*$/i] },
  { intent: 'app_open', language: 'en', patterns: [/\b(open|launch|start|run)\s+(?<app>[\w .+-]+?)(\s+(app|application|program))?\s*$/i] },
  { intent: 'app_open', language: 'sw', patterns: [/\b(fungua|anzisha)\s+(?<app>[\w .+-]+?)\s*$/i] },

  // --- Files ---
  { intent: 'file_search', language: 'en', patterns: [/\b(find|search for|look for)\s+(the\s+)?(file|document)s?\s+(named\s+)?(?<query>.+)$/i] },
  { intent: 'file_search', language: 'sw', patterns: [/\b(tafuta)\s+(faili|nyaraka)\s+(?<query>.+)$/i] },
  { intent: 'file_list', language: 'en', patterns: [/\b(list|show)\s+(me\s+)?(the\s+)?files?\s+(in|inside|from)\s+(?<folder>.+)$/i] },
  { intent: 'file_list', language: 'sw', patterns: [/\b(onyesha|orodhesha)\s+(mafaili|faili)\s+(katika|ndani ya)\s+(?<folder>.+)$/i] },
  { intent: 'file_create_folder', language: 'en', patterns: [/\b(create|make|new)\s+(a\s+)?folder\s+(called\s+|named\s+)?(?<name>.+)$/i] },
  { intent: 'file_create_folder', language: 'sw', patterns: [/\btengeneza\s+(folda|folder)\s+(?<name>.+)$/i] },
  { intent: 'file_create', language: 'en', patterns: [/\b(create|make|write)\s+(a\s+)?file\s+(?:called|named)\s+(?<name>[^ ]+)\s*(?:with\s+(?:content|text)\s+(?<content>.+))?$/i] },
  { intent: 'file_create', language: 'sw', patterns: [/\btengeneza\s+(faili|file)\s+(?:inayoitwa|linaloitwa)\s+(?<name>[^ ]+)\s*(?:lenye\s+(?:maandishi|content)\s+(?<content>.+))?$/i] },

  // --- Web ---
  { intent: 'web_search', language: 'en', patterns: [/\b(search|google|look up)\s+(the web\s+)?(for\s+)?(?<query>.+)$/i] },
  { intent: 'web_search', language: 'sw', patterns: [/\btafuta\s+(mtandaoni|google)\s+(?<query>.+)$/i] },
  { intent: 'browser_open', language: 'en', patterns: [/\b(open|go to|visit)\s+(?<site>(https?:\/\/\S+|[\w-]+\.[a-z]{2,}\S*))/i] },
  { intent: 'browser_open', language: 'sw', patterns: [/\bfungua\s+(tovuti|website)\s+(?<site>\S+)/i] },


  // --- Coding ---
  { intent: 'coding_inspect', language: 'en', patterns: [/\b(inspect|analyz|analys|review|explain)\w*\s+(the\s+)?(project|codebase|repo)\b/i] },
  { intent: 'coding_inspect', language: 'sw', patterns: [/\bchunguza\s+(mradi|project)\b/i] },
  { intent: 'prepare_dev_environment', language: 'en', patterns: [/\b(prepare|set ?up|get ready)\b.*\b(dev|development|coding|work)\b.*\b(environment|setup|session)?\b/i] },
  { intent: 'prepare_dev_environment', language: 'sw', patterns: [/\bandaa\s+(mazingira|kazi)\s+(ya\s+)?(kucodi|programu|maendeleo)\b/i] },

  // --- Memory ---
  { intent: 'memory_recall', language: 'en', patterns: [/\bwhat do you (remember|know) about\s+(?<query>.+)$/i, /\bwhat is my\s+(?<query2>.+)$/i] },
  { intent: 'memory_recall', language: 'sw', patterns: [/\bunakumbuka nini kuhusu\s+(?<query>.+)$/i] },
  { intent: 'memory_remember', language: 'en', patterns: [/\bremember (that )?(?<key>[\w .'-]+?)\s+(is|are|=)\s+(?<value>.+)$/i, /\bremember (that )?(?<value2>.+)$/i] },
  { intent: 'memory_remember', language: 'sw', patterns: [/\bkumbuka (kwamba )?(?<key>[\w .'-]+?)\s+ni\s+(?<value>.+)$/i, /\bkumbuka (?<value2>.+)$/i] },
  { intent: 'memory_forget', language: 'en', patterns: [/\bforget (everything|all)\b/i, /\bclear your memory\b/i] },
  { intent: 'memory_forget', language: 'sw', patterns: [/\bsahau (kila kitu|yote)\b/i, /\bfuta kumbukumbu\b/i] },
];

const SWAHILI_HINTS = [
  'habari', 'asante', 'tafadhali', 'fungua', 'funga', 'zima', 'tafuta', 'kumbuka',
  'nisaidie', 'kompyuta', 'faili', 'nyaraka', 'saa', 'ngapi', 'sahau', 'andaa',
];

export class RulesEngine implements IHealthCheckable {
  constructor(private readonly logger: ILogger) {}

  detectLanguage(utterance: string): Language {
    const lower = utterance.toLowerCase();
    return SWAHILI_HINTS.some((hint) => new RegExp(`\\b${hint}`, 'i').test(lower)) ? 'sw' : 'en';
  }

  parse(utterance: string): ParsedIntent {
    const text = utterance.trim();
    const language = this.detectLanguage(text);

    for (const rule of RULES) {
      for (const pattern of rule.patterns) {
        const match = pattern.exec(text);
        if (!match) continue;

        const entities: Record<string, string> = {};
        for (const [key, value] of Object.entries(match.groups ?? {})) {
          if (typeof value === 'string' && value.trim()) {
            entities[key.replace(/2$/, '')] = value.trim().replace(/[.?!]+$/, '');
          }
        }

        // A rule in the other language still matches (e.g. a URL); trust
        // the rule's own language only when it agrees with detection.
        const confidence = rule.language === language ? (rule.confidence ?? 0.92) : 0.78;
        return { name: rule.intent, confidence, language, entities, utterance: text };
      }
    }

    this.logger.debug('No rule matched utterance', { utterance: text });
    return { name: 'unknown', confidence: 0, language, entities: {}, utterance: text };
  }

  healthCheck(): ModuleStatus {
    return 'running';
  }
}
