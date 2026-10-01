import path from 'node:path';

import dotenv from 'dotenv';

/**
 * EnvLoader
 * Loads and validates environment variables once at process start.
 * Provides typed, defaulted access — nothing in the codebase should
 * read from `process.env` directly outside of this module.
 */
export interface AppEnv {
  appEnv: 'development' | 'production' | 'test';
  appName: string;
  logLevel: string;
  dbFilename: string;
  dbDirectory: string;
  logDirectory: string;
  logToFile: boolean;
  logToConsole: boolean;
  windowWidth: number;
  windowHeight: number;
  windowDevTools: boolean;
  devServerUrl: string;
  infraCommandTimeoutMs?: number;
  infraMaxRetryAttempts?: number;
  infraRetryBackoffBaseMs?: number;
  infraHealthPollIntervalMs?: number;
  infraMaxConsecutiveFailures?: number;
  audioSampleRateHz?: number;
  audioChannels?: number;
  audioBitDepth?: number;
  audioBufferCapacity?: number;
  audioMaxConcurrentSessions?: number;
  audioDefaultLanguage?: string;
  audioNoiseReductionEnabled?: boolean;
  audioEchoCancellationEnabled?: boolean;
  voiceRuntimeSessionTimeoutMs?: number;
  voiceRuntimeMaxRetryAttempts?: number;
  voiceRuntimeRetryBackoffBaseMs?: number;
  voiceProviderDefaultGender?: 'female' | 'male' | 'neutral';
  voiceProviderDefaultLanguage?: string;
  voiceProviderFallbackEnabled?: boolean;
  voiceProviderPreferredProviderId?: string;
  speechToTextDefaultLanguage?: string;
  speechToTextAutoDetectLanguage?: boolean;
  speechToTextStreamingEnabled?: boolean;
  speechToTextSupportedLanguages?: string[];
  wakeWordDefaultWakeWord?: string;
  wakeWordSensitivity?: number;
  wakeWordConfidenceThreshold?: number;
  wakeWordCooldownMs?: number;
  wakeWordSecureWakeEnabled?: boolean;
  aiOpenaiEnabled?: boolean;
  aiOpenaiModel?: string;
  aiOpenaiBaseUrl?: string;
  aiOpenaiTimeoutMs?: number;
  aiGeminiEnabled?: boolean;
  aiGeminiModel?: string;
  aiGeminiBaseUrl?: string;
  aiGeminiTimeoutMs?: number;
  aiGeminiModelDiscoveryEnabled?: boolean;
  aiClaudeEnabled?: boolean;
  aiClaudeModel?: string;
  aiClaudeBaseUrl?: string;
  aiClaudeTimeoutMs?: number;
  aiClaudeMaxTokens?: number;
  // Stage 6 (V7.2) additions — Groq / OpenRouter / Lovable AI Gateway.
  aiGroqEnabled?: boolean;
  aiGroqModel?: string;
  aiGroqBaseUrl?: string;
  aiGroqTimeoutMs?: number;
  aiOpenrouterEnabled?: boolean;
  aiOpenrouterModel?: string;
  aiOpenrouterBaseUrl?: string;
  aiOpenrouterTimeoutMs?: number;
  aiLovableEnabled?: boolean;
  aiLovableModel?: string;
  aiLovableBaseUrl?: string;
  aiLovableTimeoutMs?: number;
  aiPreferredProviderId?: string;
  aiContextMaxTurns?: number;
  aiContextMaxChars?: number;
  /**
   * Secrets. Deliberately kept OUT of `AppConfig`/`ConfigManager` — the
   * renderer can read the whole `AppConfig` via the `config:getAll` IPC
   * channel, so nothing here may ever be merged into that object. Only
   * `AppBootstrapper` reads these, to construct provider adapters directly.
   */
  openaiApiKey?: string;
  geminiApiKey?: string;
  anthropicApiKey?: string;
  /** Only relevant for workspace-scoped gateways — see ClaudeProviderOptions.workspaceId. */
  anthropicWorkspaceId?: string;
  groqApiKey?: string;
  openrouterApiKey?: string;
  lovableApiKey?: string;
  /** Stage 7 integrations. Secrets stay backend-only (never in AppConfig / IPC). */
  gmailEnabled?: boolean;
  calendarEnabled?: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
}

function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true' || value === '1';
}

function toInt(value: string | undefined, fallback: number): number {
  const parsed = value ? parseInt(value, 10) : NaN;
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toIntOptional(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function toBoolOptional(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value.toLowerCase() === 'true' || value === '1';
}

function toFloatOptional(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function toStringArrayOptional(value: string | undefined): string[] | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

let cachedEnv: AppEnv | null = null;

export function loadEnv(rootDir: string = process.cwd()): AppEnv {
  if (cachedEnv) return cachedEnv;

  dotenv.config({ path: path.join(rootDir, '.env') });

  const appEnvRaw = process.env.APP_ENV ?? 'development';
  const appEnv: AppEnv['appEnv'] =
    appEnvRaw === 'production' || appEnvRaw === 'test' ? appEnvRaw : 'development';

  cachedEnv = {
    appEnv,
    appName: process.env.APP_NAME ?? 'JARVIS',
    logLevel: process.env.APP_LOG_LEVEL ?? 'info',
    dbFilename: process.env.DB_FILENAME ?? 'jarvis.sqlite',
    dbDirectory: process.env.DB_DIRECTORY ?? './database',
    logDirectory: process.env.LOG_DIRECTORY ?? './logs',
    logToFile: toBool(process.env.LOG_TO_FILE, true),
    logToConsole: toBool(process.env.LOG_TO_CONSOLE, true),
    windowWidth: toInt(process.env.WINDOW_WIDTH, 1280),
    windowHeight: toInt(process.env.WINDOW_HEIGHT, 800),
    windowDevTools: toBool(process.env.WINDOW_DEV_TOOLS, appEnv !== 'production'),
    devServerUrl: process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173',
    infraCommandTimeoutMs: toIntOptional(process.env.INFRA_COMMAND_TIMEOUT_MS),
    infraMaxRetryAttempts: toIntOptional(process.env.INFRA_MAX_RETRY_ATTEMPTS),
    infraRetryBackoffBaseMs: toIntOptional(process.env.INFRA_RETRY_BACKOFF_BASE_MS),
    infraHealthPollIntervalMs: toIntOptional(process.env.INFRA_HEALTH_POLL_INTERVAL_MS),
    infraMaxConsecutiveFailures: toIntOptional(process.env.INFRA_MAX_CONSECUTIVE_FAILURES),
    audioSampleRateHz: toIntOptional(process.env.AUDIO_SAMPLE_RATE_HZ),
    audioChannels: toIntOptional(process.env.AUDIO_CHANNELS),
    audioBitDepth: toIntOptional(process.env.AUDIO_BIT_DEPTH),
    audioBufferCapacity: toIntOptional(process.env.AUDIO_BUFFER_CAPACITY),
    audioMaxConcurrentSessions: toIntOptional(process.env.AUDIO_MAX_CONCURRENT_SESSIONS),
    audioDefaultLanguage: process.env.AUDIO_DEFAULT_LANGUAGE,
    audioNoiseReductionEnabled: toBoolOptional(process.env.AUDIO_NOISE_REDUCTION_ENABLED),
    audioEchoCancellationEnabled: toBoolOptional(process.env.AUDIO_ECHO_CANCELLATION_ENABLED),
    voiceRuntimeSessionTimeoutMs: toIntOptional(process.env.VOICE_RUNTIME_SESSION_TIMEOUT_MS),
    voiceRuntimeMaxRetryAttempts: toIntOptional(process.env.VOICE_RUNTIME_MAX_RETRY_ATTEMPTS),
    voiceRuntimeRetryBackoffBaseMs: toIntOptional(process.env.VOICE_RUNTIME_RETRY_BACKOFF_BASE_MS),
    voiceProviderDefaultGender: process.env.VOICE_PROVIDER_DEFAULT_GENDER as
      'female' | 'male' | 'neutral' | undefined,
    voiceProviderDefaultLanguage: process.env.VOICE_PROVIDER_DEFAULT_LANGUAGE,
    voiceProviderFallbackEnabled: toBoolOptional(process.env.VOICE_PROVIDER_FALLBACK_ENABLED),
    voiceProviderPreferredProviderId: process.env.VOICE_PROVIDER_PREFERRED_PROVIDER_ID,
    speechToTextDefaultLanguage: process.env.SPEECH_TO_TEXT_DEFAULT_LANGUAGE,
    speechToTextAutoDetectLanguage: toBoolOptional(process.env.SPEECH_TO_TEXT_AUTO_DETECT_LANGUAGE),
    speechToTextStreamingEnabled: toBoolOptional(process.env.SPEECH_TO_TEXT_STREAMING_ENABLED),
    speechToTextSupportedLanguages: toStringArrayOptional(
      process.env.SPEECH_TO_TEXT_SUPPORTED_LANGUAGES,
    ),
    wakeWordDefaultWakeWord: process.env.WAKE_WORD_DEFAULT_WAKE_WORD,
    wakeWordSensitivity: toFloatOptional(process.env.WAKE_WORD_SENSITIVITY),
    wakeWordConfidenceThreshold: toFloatOptional(process.env.WAKE_WORD_CONFIDENCE_THRESHOLD),
    wakeWordCooldownMs: toIntOptional(process.env.WAKE_WORD_COOLDOWN_MS),
    wakeWordSecureWakeEnabled: toBoolOptional(process.env.WAKE_WORD_SECURE_WAKE_ENABLED),
    aiOpenaiEnabled: toBoolOptional(process.env.OPENAI_ENABLED),
    aiOpenaiModel: process.env.OPENAI_MODEL,
    aiOpenaiBaseUrl: process.env.OPENAI_BASE_URL,
    aiOpenaiTimeoutMs: toIntOptional(process.env.OPENAI_TIMEOUT_MS),
    aiGeminiEnabled: toBoolOptional(process.env.GEMINI_ENABLED),
    aiGeminiModel: process.env.GEMINI_MODEL,
    aiGeminiBaseUrl: process.env.GEMINI_BASE_URL,
    aiGeminiTimeoutMs: toIntOptional(process.env.GEMINI_TIMEOUT_MS),
    aiGeminiModelDiscoveryEnabled: toBoolOptional(process.env.GEMINI_MODEL_DISCOVERY_ENABLED),
    aiClaudeEnabled: toBoolOptional(process.env.CLAUDE_ENABLED),
    aiClaudeModel: process.env.CLAUDE_MODEL,
    aiClaudeBaseUrl: process.env.CLAUDE_BASE_URL,
    aiClaudeTimeoutMs: toIntOptional(process.env.CLAUDE_TIMEOUT_MS),
    aiClaudeMaxTokens: toIntOptional(process.env.CLAUDE_MAX_TOKENS),
    aiGroqEnabled: toBoolOptional(process.env.GROQ_ENABLED),
    aiGroqModel: process.env.GROQ_MODEL,
    aiGroqBaseUrl: process.env.GROQ_BASE_URL,
    aiGroqTimeoutMs: toIntOptional(process.env.GROQ_TIMEOUT_MS),
    aiOpenrouterEnabled: toBoolOptional(process.env.OPENROUTER_ENABLED),
    aiOpenrouterModel: process.env.OPENROUTER_MODEL,
    aiOpenrouterBaseUrl: process.env.OPENROUTER_BASE_URL,
    aiOpenrouterTimeoutMs: toIntOptional(process.env.OPENROUTER_TIMEOUT_MS),
    aiLovableEnabled: toBoolOptional(process.env.LOVABLE_ENABLED),
    aiLovableModel: process.env.LOVABLE_MODEL,
    aiLovableBaseUrl: process.env.LOVABLE_BASE_URL,
    aiLovableTimeoutMs: toIntOptional(process.env.LOVABLE_TIMEOUT_MS),
    aiPreferredProviderId: process.env.AI_PROVIDER_PRIMARY,
    aiContextMaxTurns: toIntOptional(process.env.AI_CONTEXT_MAX_TURNS),
    aiContextMaxChars: toIntOptional(process.env.AI_CONTEXT_MAX_CHARS),
    // Secrets — read once here, never copied into AppConfig (see field comment above).
    openaiApiKey: process.env.OPENAI_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicWorkspaceId: process.env.ANTHROPIC_WORKSPACE_ID,
    groqApiKey: process.env.GROQ_API_KEY,
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    lovableApiKey: process.env.LOVABLE_API_KEY,
    gmailEnabled: toBoolOptional(process.env.GMAIL_ENABLED),
    calendarEnabled: toBoolOptional(process.env.CALENDAR_ENABLED),
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };

  return cachedEnv;
}
