import type { AppConfig } from '@backend/config/IConfigManager';
import { APP_METADATA, DEFAULT_WINDOW_OPTIONS } from '@backend/core/constants';
import { INFRASTRUCTURE_DEFAULTS } from '@backend/shared/constants/infrastructure.constants';

/**
 * Built-in, hardcode-free defaults. These are the last resort fallback —
 * any value here can be overridden by config/app.config.json or by
 * environment variables (see core/env.ts).
 */
export const DEFAULT_CONFIG: AppConfig = {
  app: {
    name: APP_METADATA.name,
    environment: 'development',
  },
  window: {
    width: DEFAULT_WINDOW_OPTIONS.width,
    height: DEFAULT_WINDOW_OPTIONS.height,
    devTools: true,
  },
  renderer: {
    devServerUrl: 'http://127.0.0.1:5173',
  },
  infrastructure: {
    commandTimeoutMs: INFRASTRUCTURE_DEFAULTS.communicationBus.commandTimeoutMs,
    maxRetryAttempts: INFRASTRUCTURE_DEFAULTS.communicationBus.maxRetryAttempts,
    retryBackoffBaseMs: INFRASTRUCTURE_DEFAULTS.communicationBus.retryBackoffBaseMs,
    healthPollIntervalMs: INFRASTRUCTURE_DEFAULTS.healthMonitor.pollIntervalMs,
    maxConsecutiveFailures: INFRASTRUCTURE_DEFAULTS.healthMonitor.maxConsecutiveFailures,
  },
  audio: {
    sampleRateHz: 16000,
    channels: 1,
    bitDepth: 16,
    bufferCapacity: 50,
    maxConcurrentSessions: 1,
    defaultLanguage: 'en-US',
    noiseReductionEnabled: false,
    echoCancellationEnabled: false,
  },
  voiceRuntime: {
    defaultSessionTimeoutMs: 30000,
    maxRetryAttempts: INFRASTRUCTURE_DEFAULTS.communicationBus.maxRetryAttempts,
    retryBackoffBaseMs: INFRASTRUCTURE_DEFAULTS.communicationBus.retryBackoffBaseMs,
  },
  voiceProvider: {
    defaultGender: 'female',
    defaultLanguage: 'en-US',
    fallbackEnabled: true,
    preferredProviderId: null,
  },
  speechToText: {
    defaultLanguage: 'en-US',
    autoDetectLanguage: false,
    supportedLanguages: ['en-US', 'sw-KE'],
    streamingEnabled: true,
  },
  wakeWord: {
    defaultWakeWord: 'Jarvis',
    sensitivity: 0.5,
    confidenceThreshold: 0.6,
    cooldownMs: 1500,
    secureWakeEnabled: false,
  },
  ai: {
    providers: {
      openai: { enabled: true, model: 'gpt-4.1-mini', timeoutMs: 20_000 },
      // V7.2: gemini-2.5-flash is restricted for newer projects. gemini-3.8-flash is the current stable
      // GA flash model as of this build; GeminiProvider additionally
      // self-heals past whatever is current by then (see Feature G /
      // GeminiProvider's model-discovery fallback) so this default is a
      // starting point, not a hard dependency.
      gemini: { enabled: true, model: 'gemini-3.8-flash', timeoutMs: 20_000, modelDiscoveryEnabled: true },
      claude: { enabled: true, model: 'claude-sonnet-4-6', timeoutMs: 20_000, maxTokens: 4096 },
      // Stage 6 additions. Models are left blank by design where the
      // provider's catalog is too broad/volatile for one safe default
      // (OpenRouter/Lovable) — see docs/AI_PROVIDERS.md. A blank model
      // keeps isConfigured() false until the operator picks one, so an
      // unset provider never silently enters the fallback chain half-configured.
      groq: { enabled: true, model: 'llama-3.3-70b-versatile', timeoutMs: 20_000 },
      openrouter: { enabled: true, model: '', timeoutMs: 20_000 },
      lovable: { enabled: true, model: '', timeoutMs: 20_000 },
    },
    priorities: {
      // Feature E's example chain (Gemini -> Groq -> Lovable -> OpenRouter
      // -> Claude -> OpenAI -> local) is used as the starting point for
      // 'general', reordered only where an existing, already-tuned
      // per-task preference exists (coding/multimodal/planning keep their
      // prior leaders and simply gain the three new providers as
      // additional fallback depth). 'local' always stays last everywhere.
      general: ['gemini', 'groq', 'lovable', 'openrouter', 'claude', 'openai', 'local'],
      coding: ['claude', 'openai', 'groq', 'openrouter', 'gemini', 'lovable', 'local'],
      multimodal: ['gemini', 'openai', 'claude', 'lovable', 'openrouter', 'groq', 'local'],
      planning: ['openai', 'claude', 'gemini', 'groq', 'lovable', 'openrouter', 'local'],
    },
    preferredProviderId: null,
    contextMaxTurns: 12,
    contextMaxChars: 8000,
  },
  database: {
    filename: 'jarvis.sqlite',
    directory: './database',
  },
  logging: {
    level: 'info',
    directory: './logs',
    toFile: true,
    toConsole: true,
  },
};
