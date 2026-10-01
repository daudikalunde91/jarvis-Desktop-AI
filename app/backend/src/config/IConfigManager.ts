export interface AppConfig {
  app: {
    name: string;
    environment: 'development' | 'production' | 'test';
  };
  window: {
    width: number;
    height: number;
    devTools: boolean;
  };
  renderer: {
    /** Vite dev server URL used only when app.environment === 'development'. */
    devServerUrl: string;
  };
  infrastructure: {
    commandTimeoutMs: number;
    maxRetryAttempts: number;
    retryBackoffBaseMs: number;
    healthPollIntervalMs: number;
    maxConsecutiveFailures: number;
  };
  audio: {
    sampleRateHz: number;
    channels: number;
    bitDepth: number;
    bufferCapacity: number;
    maxConcurrentSessions: number;
    defaultLanguage: string;
    noiseReductionEnabled: boolean;
    echoCancellationEnabled: boolean;
  };
  voiceRuntime: {
    defaultSessionTimeoutMs: number;
    maxRetryAttempts: number;
    retryBackoffBaseMs: number;
  };
  voiceProvider: {
    defaultGender: 'female' | 'male' | 'neutral';
    defaultLanguage: string;
    fallbackEnabled: boolean;
    preferredProviderId: string | null;
  };
  speechToText: {
    defaultLanguage: string;
    autoDetectLanguage: boolean;
    supportedLanguages: string[];
    streamingEnabled: boolean;
  };
  wakeWord: {
    defaultWakeWord: string;
    sensitivity: number;
    confidenceThreshold: number;
    cooldownMs: number;
    secureWakeEnabled: boolean;
  };
  /**
   * AI Orchestration (M5.1). Non-secret settings only — API keys never
   * live here because the whole `AppConfig` is readable by the renderer
   * via the `config:getAll` IPC channel. See `core/env.ts` for keys.
   */
  ai: {
    providers: {
      openai: { enabled: boolean; model: string; baseUrl?: string; timeoutMs: number };
      gemini: { enabled: boolean; model: string; baseUrl?: string; timeoutMs: number; modelDiscoveryEnabled: boolean };
      claude: { enabled: boolean; model: string; baseUrl?: string; timeoutMs: number; maxTokens: number };
      /** Stage 6 / Feature B. */
      groq: { enabled: boolean; model: string; baseUrl?: string; timeoutMs: number };
      /** Stage 6 / Feature D. */
      openrouter: { enabled: boolean; model: string; baseUrl?: string; timeoutMs: number };
      /** Stage 6 / Feature C. */
      lovable: { enabled: boolean; model: string; baseUrl?: string; timeoutMs: number };
    };
    /** Provider id priority order per task type. First eligible + configured wins. */
    priorities: {
      general: readonly string[];
      coding: readonly string[];
      multimodal: readonly string[];
      planning: readonly string[];
    };
    preferredProviderId: string | null;
    contextMaxTurns: number;
    contextMaxChars: number;
  };
  database: {
    filename: string;
    directory: string;
  };
  logging: {
    level: string;
    directory: string;
    toFile: boolean;
    toConsole: boolean;
  };
}

/**
 * Configuration Manager abstraction.
 * Merges (in increasing priority): built-in defaults -> config/app.config.json
 * -> environment variables. Consumers only ever read through `get`.
 */
export interface IConfigManager {
  load(): AppConfig;
  get<K extends keyof AppConfig>(section: K): AppConfig[K];
  getAll(): AppConfig;
}
