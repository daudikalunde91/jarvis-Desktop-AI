import fs from 'node:fs';
import path from 'node:path';

import type { AppConfig, IConfigManager } from '@backend/config/IConfigManager';
import { DEFAULT_CONFIG } from '@backend/config/default.config';
import type { AppEnv } from '@backend/core/env';
import { ConfigError } from '@backend/core/errors/AppError';

/**
 * File-backed Configuration Manager.
 *
 * Precedence (lowest to highest):
 *   1. DEFAULT_CONFIG (compiled-in defaults)
 *   2. config/app.config.json (user/deployment overrides)
 *   3. Environment variables (loaded via EnvLoader)
 */
export class ConfigManager implements IConfigManager {
  private config: AppConfig | null = null;

  constructor(
    private readonly configFilePath: string,
    private readonly env: AppEnv,
  ) {}

  load(): AppConfig {
    const fileConfig = this.readConfigFile();

    this.config = {
      app: {
        name: this.env.appName ?? fileConfig.app?.name ?? DEFAULT_CONFIG.app.name,
        environment:
          this.env.appEnv ?? fileConfig.app?.environment ?? DEFAULT_CONFIG.app.environment,
      },
      window: {
        width: this.env.windowWidth ?? fileConfig.window?.width ?? DEFAULT_CONFIG.window.width,
        height: this.env.windowHeight ?? fileConfig.window?.height ?? DEFAULT_CONFIG.window.height,
        devTools:
          this.env.windowDevTools ?? fileConfig.window?.devTools ?? DEFAULT_CONFIG.window.devTools,
      },
      renderer: {
        devServerUrl:
          this.env.devServerUrl ??
          fileConfig.renderer?.devServerUrl ??
          DEFAULT_CONFIG.renderer.devServerUrl,
      },
      infrastructure: {
        commandTimeoutMs:
          this.env.infraCommandTimeoutMs ??
          fileConfig.infrastructure?.commandTimeoutMs ??
          DEFAULT_CONFIG.infrastructure.commandTimeoutMs,
        maxRetryAttempts:
          this.env.infraMaxRetryAttempts ??
          fileConfig.infrastructure?.maxRetryAttempts ??
          DEFAULT_CONFIG.infrastructure.maxRetryAttempts,
        retryBackoffBaseMs:
          this.env.infraRetryBackoffBaseMs ??
          fileConfig.infrastructure?.retryBackoffBaseMs ??
          DEFAULT_CONFIG.infrastructure.retryBackoffBaseMs,
        healthPollIntervalMs:
          this.env.infraHealthPollIntervalMs ??
          fileConfig.infrastructure?.healthPollIntervalMs ??
          DEFAULT_CONFIG.infrastructure.healthPollIntervalMs,
        maxConsecutiveFailures:
          this.env.infraMaxConsecutiveFailures ??
          fileConfig.infrastructure?.maxConsecutiveFailures ??
          DEFAULT_CONFIG.infrastructure.maxConsecutiveFailures,
      },
      audio: {
        sampleRateHz:
          this.env.audioSampleRateHz ??
          fileConfig.audio?.sampleRateHz ??
          DEFAULT_CONFIG.audio.sampleRateHz,
        channels:
          this.env.audioChannels ?? fileConfig.audio?.channels ?? DEFAULT_CONFIG.audio.channels,
        bitDepth:
          this.env.audioBitDepth ?? fileConfig.audio?.bitDepth ?? DEFAULT_CONFIG.audio.bitDepth,
        bufferCapacity:
          this.env.audioBufferCapacity ??
          fileConfig.audio?.bufferCapacity ??
          DEFAULT_CONFIG.audio.bufferCapacity,
        maxConcurrentSessions:
          this.env.audioMaxConcurrentSessions ??
          fileConfig.audio?.maxConcurrentSessions ??
          DEFAULT_CONFIG.audio.maxConcurrentSessions,
        defaultLanguage:
          this.env.audioDefaultLanguage ??
          fileConfig.audio?.defaultLanguage ??
          DEFAULT_CONFIG.audio.defaultLanguage,
        noiseReductionEnabled:
          this.env.audioNoiseReductionEnabled ??
          fileConfig.audio?.noiseReductionEnabled ??
          DEFAULT_CONFIG.audio.noiseReductionEnabled,
        echoCancellationEnabled:
          this.env.audioEchoCancellationEnabled ??
          fileConfig.audio?.echoCancellationEnabled ??
          DEFAULT_CONFIG.audio.echoCancellationEnabled,
      },
      voiceRuntime: {
        defaultSessionTimeoutMs:
          this.env.voiceRuntimeSessionTimeoutMs ??
          fileConfig.voiceRuntime?.defaultSessionTimeoutMs ??
          DEFAULT_CONFIG.voiceRuntime.defaultSessionTimeoutMs,
        maxRetryAttempts:
          this.env.voiceRuntimeMaxRetryAttempts ??
          fileConfig.voiceRuntime?.maxRetryAttempts ??
          DEFAULT_CONFIG.voiceRuntime.maxRetryAttempts,
        retryBackoffBaseMs:
          this.env.voiceRuntimeRetryBackoffBaseMs ??
          fileConfig.voiceRuntime?.retryBackoffBaseMs ??
          DEFAULT_CONFIG.voiceRuntime.retryBackoffBaseMs,
      },
      voiceProvider: {
        defaultGender:
          this.env.voiceProviderDefaultGender ??
          fileConfig.voiceProvider?.defaultGender ??
          DEFAULT_CONFIG.voiceProvider.defaultGender,
        defaultLanguage:
          this.env.voiceProviderDefaultLanguage ??
          fileConfig.voiceProvider?.defaultLanguage ??
          DEFAULT_CONFIG.voiceProvider.defaultLanguage,
        fallbackEnabled:
          this.env.voiceProviderFallbackEnabled ??
          fileConfig.voiceProvider?.fallbackEnabled ??
          DEFAULT_CONFIG.voiceProvider.fallbackEnabled,
        preferredProviderId:
          this.env.voiceProviderPreferredProviderId ??
          fileConfig.voiceProvider?.preferredProviderId ??
          DEFAULT_CONFIG.voiceProvider.preferredProviderId,
      },
      speechToText: {
        defaultLanguage:
          this.env.speechToTextDefaultLanguage ??
          fileConfig.speechToText?.defaultLanguage ??
          DEFAULT_CONFIG.speechToText.defaultLanguage,
        autoDetectLanguage:
          this.env.speechToTextAutoDetectLanguage ??
          fileConfig.speechToText?.autoDetectLanguage ??
          DEFAULT_CONFIG.speechToText.autoDetectLanguage,
        supportedLanguages:
          this.env.speechToTextSupportedLanguages ??
          fileConfig.speechToText?.supportedLanguages ??
          DEFAULT_CONFIG.speechToText.supportedLanguages,
        streamingEnabled:
          this.env.speechToTextStreamingEnabled ??
          fileConfig.speechToText?.streamingEnabled ??
          DEFAULT_CONFIG.speechToText.streamingEnabled,
      },
      wakeWord: {
        defaultWakeWord:
          this.env.wakeWordDefaultWakeWord ??
          fileConfig.wakeWord?.defaultWakeWord ??
          DEFAULT_CONFIG.wakeWord.defaultWakeWord,
        sensitivity:
          this.env.wakeWordSensitivity ??
          fileConfig.wakeWord?.sensitivity ??
          DEFAULT_CONFIG.wakeWord.sensitivity,
        confidenceThreshold:
          this.env.wakeWordConfidenceThreshold ??
          fileConfig.wakeWord?.confidenceThreshold ??
          DEFAULT_CONFIG.wakeWord.confidenceThreshold,
        cooldownMs:
          this.env.wakeWordCooldownMs ??
          fileConfig.wakeWord?.cooldownMs ??
          DEFAULT_CONFIG.wakeWord.cooldownMs,
        secureWakeEnabled:
          this.env.wakeWordSecureWakeEnabled ??
          fileConfig.wakeWord?.secureWakeEnabled ??
          DEFAULT_CONFIG.wakeWord.secureWakeEnabled,
      },
      database: {
        filename:
          this.env.dbFilename ?? fileConfig.database?.filename ?? DEFAULT_CONFIG.database.filename,
        directory:
          this.env.dbDirectory ??
          fileConfig.database?.directory ??
          DEFAULT_CONFIG.database.directory,
      },
      logging: {
        level: this.env.logLevel ?? fileConfig.logging?.level ?? DEFAULT_CONFIG.logging.level,
        directory:
          this.env.logDirectory ??
          fileConfig.logging?.directory ??
          DEFAULT_CONFIG.logging.directory,
        toFile: this.env.logToFile ?? fileConfig.logging?.toFile ?? DEFAULT_CONFIG.logging.toFile,
        toConsole:
          this.env.logToConsole ??
          fileConfig.logging?.toConsole ??
          DEFAULT_CONFIG.logging.toConsole,
      },
      ai: {
        providers: {
          openai: {
            enabled:
              this.env.aiOpenaiEnabled ??
              fileConfig.ai?.providers?.openai?.enabled ??
              DEFAULT_CONFIG.ai.providers.openai.enabled,
            model:
              this.env.aiOpenaiModel ??
              fileConfig.ai?.providers?.openai?.model ??
              DEFAULT_CONFIG.ai.providers.openai.model,
            baseUrl: this.env.aiOpenaiBaseUrl ?? fileConfig.ai?.providers?.openai?.baseUrl,
            timeoutMs:
              this.env.aiOpenaiTimeoutMs ??
              fileConfig.ai?.providers?.openai?.timeoutMs ??
              DEFAULT_CONFIG.ai.providers.openai.timeoutMs,
          },
          gemini: {
            enabled:
              this.env.aiGeminiEnabled ??
              fileConfig.ai?.providers?.gemini?.enabled ??
              DEFAULT_CONFIG.ai.providers.gemini.enabled,
            model:
              this.env.aiGeminiModel ??
              fileConfig.ai?.providers?.gemini?.model ??
              DEFAULT_CONFIG.ai.providers.gemini.model,
            baseUrl: this.env.aiGeminiBaseUrl ?? fileConfig.ai?.providers?.gemini?.baseUrl,
            timeoutMs:
              this.env.aiGeminiTimeoutMs ??
              fileConfig.ai?.providers?.gemini?.timeoutMs ??
              DEFAULT_CONFIG.ai.providers.gemini.timeoutMs,
            modelDiscoveryEnabled:
              this.env.aiGeminiModelDiscoveryEnabled ??
              fileConfig.ai?.providers?.gemini?.modelDiscoveryEnabled ??
              DEFAULT_CONFIG.ai.providers.gemini.modelDiscoveryEnabled,
          },
          claude: {
            enabled:
              this.env.aiClaudeEnabled ??
              fileConfig.ai?.providers?.claude?.enabled ??
              DEFAULT_CONFIG.ai.providers.claude.enabled,
            model:
              this.env.aiClaudeModel ??
              fileConfig.ai?.providers?.claude?.model ??
              DEFAULT_CONFIG.ai.providers.claude.model,
            baseUrl: this.env.aiClaudeBaseUrl ?? fileConfig.ai?.providers?.claude?.baseUrl,
            timeoutMs:
              this.env.aiClaudeTimeoutMs ??
              fileConfig.ai?.providers?.claude?.timeoutMs ??
              DEFAULT_CONFIG.ai.providers.claude.timeoutMs,
            maxTokens:
              this.env.aiClaudeMaxTokens ??
              fileConfig.ai?.providers?.claude?.maxTokens ??
              DEFAULT_CONFIG.ai.providers.claude.maxTokens,
          },
          groq: {
            enabled:
              this.env.aiGroqEnabled ?? fileConfig.ai?.providers?.groq?.enabled ?? DEFAULT_CONFIG.ai.providers.groq.enabled,
            model:
              this.env.aiGroqModel ?? fileConfig.ai?.providers?.groq?.model ?? DEFAULT_CONFIG.ai.providers.groq.model,
            baseUrl: this.env.aiGroqBaseUrl ?? fileConfig.ai?.providers?.groq?.baseUrl,
            timeoutMs:
              this.env.aiGroqTimeoutMs ??
              fileConfig.ai?.providers?.groq?.timeoutMs ??
              DEFAULT_CONFIG.ai.providers.groq.timeoutMs,
          },
          openrouter: {
            enabled:
              this.env.aiOpenrouterEnabled ??
              fileConfig.ai?.providers?.openrouter?.enabled ??
              DEFAULT_CONFIG.ai.providers.openrouter.enabled,
            model:
              this.env.aiOpenrouterModel ??
              fileConfig.ai?.providers?.openrouter?.model ??
              DEFAULT_CONFIG.ai.providers.openrouter.model,
            baseUrl: this.env.aiOpenrouterBaseUrl ?? fileConfig.ai?.providers?.openrouter?.baseUrl,
            timeoutMs:
              this.env.aiOpenrouterTimeoutMs ??
              fileConfig.ai?.providers?.openrouter?.timeoutMs ??
              DEFAULT_CONFIG.ai.providers.openrouter.timeoutMs,
          },
          lovable: {
            enabled:
              this.env.aiLovableEnabled ??
              fileConfig.ai?.providers?.lovable?.enabled ??
              DEFAULT_CONFIG.ai.providers.lovable.enabled,
            model:
              this.env.aiLovableModel ??
              fileConfig.ai?.providers?.lovable?.model ??
              DEFAULT_CONFIG.ai.providers.lovable.model,
            baseUrl: this.env.aiLovableBaseUrl ?? fileConfig.ai?.providers?.lovable?.baseUrl,
            timeoutMs:
              this.env.aiLovableTimeoutMs ??
              fileConfig.ai?.providers?.lovable?.timeoutMs ??
              DEFAULT_CONFIG.ai.providers.lovable.timeoutMs,
          },
        },
        priorities: {
          general: fileConfig.ai?.priorities?.general ?? DEFAULT_CONFIG.ai.priorities.general,
          coding: fileConfig.ai?.priorities?.coding ?? DEFAULT_CONFIG.ai.priorities.coding,
          multimodal:
            fileConfig.ai?.priorities?.multimodal ?? DEFAULT_CONFIG.ai.priorities.multimodal,
          planning: fileConfig.ai?.priorities?.planning ?? DEFAULT_CONFIG.ai.priorities.planning,
        },
        preferredProviderId:
          this.env.aiPreferredProviderId ??
          fileConfig.ai?.preferredProviderId ??
          DEFAULT_CONFIG.ai.preferredProviderId,
        contextMaxTurns:
          this.env.aiContextMaxTurns ?? fileConfig.ai?.contextMaxTurns ?? DEFAULT_CONFIG.ai.contextMaxTurns,
        contextMaxChars:
          this.env.aiContextMaxChars ??
          fileConfig.ai?.contextMaxChars ??
          DEFAULT_CONFIG.ai.contextMaxChars,
      },
    };

    return this.config;
  }

  private readConfigFile(): Partial<AppConfig> {
    try {
      if (!fs.existsSync(this.configFilePath)) {
        return {};
      }
      const raw = fs.readFileSync(this.configFilePath, 'utf-8');
      return JSON.parse(raw) as Partial<AppConfig>;
    } catch (error) {
      throw new ConfigError(`Failed to read configuration file at ${this.configFilePath}`, {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  get<K extends keyof AppConfig>(section: K): AppConfig[K] {
    if (!this.config) {
      throw new ConfigError('ConfigManager.get() called before load()');
    }
    return this.config[section];
  }

  getAll(): AppConfig {
    if (!this.config) {
      throw new ConfigError('ConfigManager.getAll() called before load()');
    }
    return this.config;
  }

  static resolveDefaultPath(rootDir: string): string {
    return path.join(rootDir, 'config', 'app.config.json');
  }
}
