import path from 'node:path';
import { app, safeStorage, shell } from 'electron';

import { loadEnv } from '@backend/core/env';
import { ErrorHandler } from '@backend/core/errors/ErrorHandler';
import type { LogLevel } from '@backend/core/constants';
import { ConfigManager } from '@backend/config/ConfigManager';
import { Logger } from '@backend/logging/Logger';
import { ConsoleTransport } from '@backend/logging/transports/ConsoleTransport';
import { FileTransport } from '@backend/logging/transports/FileTransport';
import type { ILogger, ILogTransport } from '@backend/logging/ILogger';
import { FolderBootstrap } from '@backend/bootstrap/FolderBootstrap';
import { DatabaseManager } from '@backend/database/DatabaseManager';
import { IpcRouter } from '@backend/ipc/IpcRouter';
import { registerIpc } from '@backend/ipc/registerIpc';
import { WindowManager } from '@backend/windows/WindowManager';
import { DIContainer } from '@backend/infrastructure/di-container';
import { CommunicationBus } from '@backend/infrastructure/communication-bus';
import { EventSystem } from '@backend/infrastructure/event-system';
import { CapabilityRegistry } from '@backend/infrastructure/capability-registry';
import { HealthMonitor } from '@backend/infrastructure/health-monitor';
import { AgentManager } from '@backend/infrastructure/agent-manager';
import { INFRA_TOKENS } from '@backend/infrastructure/tokens';
import type { ICommunicationBus } from '@backend/infrastructure/communication-bus';
import type { IEventSystem } from '@backend/infrastructure/event-system';
import type { ICapabilityRegistry } from '@backend/infrastructure/capability-registry';
import type { IHealthMonitor } from '@backend/infrastructure/health-monitor';
import type { IAgentManager } from '@backend/infrastructure/agent-manager';
import type { IDIContainer } from '@backend/shared/interfaces/IDIContainer';
import { AudioManager } from '@backend/audio/AudioManager';
import { AudioRouter } from '@backend/audio/AudioRouter';
import { AudioFactory } from '@backend/audio/AudioFactory';
import { AUDIO_TOKENS } from '@backend/audio/tokens';
import type { IAudioManager } from '@backend/audio/interfaces/IAudioManager';
import type { IAudioRouter } from '@backend/audio/interfaces/IAudioRouter';
import type { IAudioFactory } from '@backend/audio/interfaces/IAudioFactory';
import { VoiceRuntimeManager } from '@backend/voice-runtime/VoiceRuntimeManager';
import { VoiceRuntimeFactory } from '@backend/voice-runtime/VoiceRuntimeFactory';
import { VOICE_RUNTIME_TOKENS } from '@backend/voice-runtime/tokens';
import type { IVoiceRuntimeManager } from '@backend/voice-runtime/interfaces/IVoiceRuntimeManager';
import type { IVoiceRuntimeFactory } from '@backend/voice-runtime/interfaces/IVoiceRuntimeFactory';
import { WakeWordManager } from '@backend/wake-word/WakeWordManager';
import { WakeWordProviderRegistry } from '@backend/wake-word/WakeWordProviderRegistry';
import { WakeWordProviderFactory } from '@backend/wake-word/WakeWordProviderFactory';
import { WAKE_WORD_TOKENS } from '@backend/wake-word/tokens';
import { SpeechManager } from '@backend/speech-to-text/SpeechManager';
import { SpeechProviderRegistry } from '@backend/speech-to-text/SpeechProviderRegistry';
import { SpeechProviderFactory } from '@backend/speech-to-text/SpeechProviderFactory';
import { SPEECH_TOKENS } from '@backend/speech-to-text/tokens';
import { VoiceManager } from '@backend/voice-provider/VoiceManager';
import { VoiceProviderRegistry } from '@backend/voice-provider/VoiceProviderRegistry';
import { VoiceProviderFactory } from '@backend/voice-provider/VoiceProviderFactory';
import { VOICE_PROVIDER_TOKENS } from '@backend/voice-provider/tokens';
import type { IWakeWordManager } from '@backend/voice-runtime/interfaces/IWakeWordManager';
import type { ISpeechManager } from '@backend/voice-runtime/interfaces/ISpeechManager';
import type { IVoiceManager } from '@backend/voice-runtime/interfaces/IVoiceManager';
import { BrainManager } from '@backend/brain/BrainManager';
import { RulesEngine } from '@backend/brain/RulesEngine';
import { TaskPlanner } from '@backend/brain/TaskPlanner';
import { ActionExecutor } from '@backend/brain/ActionExecutor';
import { BRAIN_TOKENS } from '@backend/brain/tokens';
import { AI_TOKENS } from '@backend/ai/tokens';
import { AIOrchestrator } from '@backend/ai/AIOrchestrator';
import { ProviderRegistry } from '@backend/ai/ProviderRegistry';
import { ProviderHealthManager } from '@backend/ai/ProviderHealthManager';
import { ProviderRouter } from '@backend/ai/ProviderRouter';
import { FallbackManager } from '@backend/ai/FallbackManager';
import { UsageTracker } from '@backend/ai/UsageTracker';
import { ContextManager } from '@backend/ai/ContextManager';
import { OpenAIProvider } from '@backend/ai/providers/OpenAIProvider';
import { GeminiProvider } from '@backend/ai/providers/GeminiProvider';
import { ClaudeProvider } from '@backend/ai/providers/ClaudeProvider';
import { LocalProvider } from '@backend/ai/providers/LocalProvider';
import { GroqProvider } from '@backend/ai/providers/GroqProvider';
import { OpenRouterProvider } from '@backend/ai/providers/OpenRouterProvider';
import { LovableProvider } from '@backend/ai/providers/LovableProvider';
import { ToolRegistry } from '@backend/ai/tools/ToolRegistry';
import type { AppConfig } from '@backend/config/IConfigManager';
import type { AppEnv } from '@backend/core/env';
import { ActionAgentRegistry } from '@backend/agents/ActionAgentRegistry';
import { ShellCommandRunner } from '@backend/agents/runtime/ShellCommandRunner';
import { SystemAgent } from '@backend/agents/system/SystemAgent';
import { FileAgent } from '@backend/agents/files/FileAgent';
import { BrowserAgent } from '@backend/agents/browser/BrowserAgent';
import { CodingAgent } from '@backend/agents/coding/CodingAgent';
import { MemoryAgent } from '@backend/agents/memory/MemoryAgent';
import { OfficeAgent } from '@backend/agents/office/OfficeAgent';
import { VisionAgent } from '@backend/agents/vision/VisionAgent';
import { AGENT_TOKENS } from '@backend/agents/tokens';
import { PermissionManager } from '@backend/security/PermissionManager';
import { SECURITY_TOKENS } from '@backend/security/tokens';
import { createIntegrations } from '@backend/integrations/createIntegrations';
import { IntegrationAgent } from '@backend/integrations/IntegrationAgent';
import { ElectronSafeStorageCipher } from '@backend/integrations/credentials/ElectronSafeStorageCipher';
import type { IntegrationManager } from '@backend/integrations/IntegrationManager';
import { MemoryManager } from '@backend/memory/MemoryManager';
import { SqliteMemoryRepository } from '@backend/memory/SqliteMemoryRepository';
import { MEMORY_TOKENS } from '@backend/memory/tokens';

/**
 * Composition root for the JARVIS main process.
 *
 * Responsible ONLY for constructing and wiring subsystems in the correct
 * order (config -> logging -> error handling -> folders -> database ->
 * core infrastructure -> audio pipeline -> voice runtime -> ipc ->
 * window). It does NOT own Electron application-lifecycle events
 * (app.whenReady, activate, window-all-closed, ...) — that
 * responsibility belongs to `lifecycle/AppLifecycle.ts`, which drives
 * this class from the outside.
 */
export class AppBootstrapper {
  private logger!: Logger;
  private errorHandler!: ErrorHandler;
  private configManager!: ConfigManager;
  private databaseManager!: DatabaseManager;
  private ipcRouter!: IpcRouter;
  private windowManager!: WindowManager;
  private container!: DIContainer;
  private communicationBus!: ICommunicationBus;
  private eventSystem!: IEventSystem;
  private capabilityRegistry!: ICapabilityRegistry;
  private healthMonitor!: IHealthMonitor;
  private agentManager!: IAgentManager;
  private audioManager!: IAudioManager;
  private audioRouter!: IAudioRouter;
  private audioFactory!: IAudioFactory;
  private wakeWordManager!: IWakeWordManager;
  private speechManager!: ISpeechManager;
  private voiceManager!: IVoiceManager;
  private voiceRuntimeManager!: IVoiceRuntimeManager;
  private voiceRuntimeFactory!: IVoiceRuntimeFactory;
  private brainManager!: BrainManager;
  private aiOrchestrator!: AIOrchestrator;
  private integrationManager!: IntegrationManager;

  // This file lives at <project>/app/backend/{src|dist}/bootstrap/AppBootstrapper.{ts|js},
  // so __dirname is <project>/app/backend/{src|dist}/bootstrap -> four levels up to <project>.
  // (Previously this only went up three levels, which resolved to <project>/app instead of
  // <project> and silently broke the preload path — see WindowManager wiring below.)
  private readonly rootDir = path.resolve(__dirname, '..', '..', '..', '..');

  async start(): Promise<void> {
    const env = loadEnv(this.rootDir);

    // 1. Config must load first — everything else depends on it.
    this.configManager = new ConfigManager(ConfigManager.resolveDefaultPath(this.rootDir), env);
    const config = this.configManager.load();

    // 2. Logging is bootstrapped from resolved config.
    const transports: ILogTransport[] = [];
    if (config.logging.toConsole) transports.push(new ConsoleTransport());
    if (config.logging.toFile) {
      transports.push(new FileTransport(path.join(this.rootDir, config.logging.directory)));
    }
    this.logger = new Logger(transports, config.logging.level as LogLevel);

    // 3. Global error handling, wired to the logger.
    this.errorHandler = new ErrorHandler(this.logger);
    this.errorHandler.registerGlobalHandlers();

    // 4. Ensure runtime folder layout exists.
    new FolderBootstrap(this.rootDir, this.logger).run();

    // Initialize and show the desktop window before native/database services.
    // The renderer will retry IPC while the backend finishes booting.
    this.initializeWindowManager(config);
    this.windowManager.createMainWindow();

    // 5. Database connection (foundation only — no schema yet).
    this.databaseManager = new DatabaseManager(
      path.join(this.rootDir, config.database.directory),
      config.database.filename,
      this.logger,
    );
    this.databaseManager.connect();

    // 6. Core Infrastructure — wired through the DI Container so future
    //    agents/plugins resolve the same singletons instead of
    //    constructing their own. No business/AI logic lives here.
    this.container = new DIContainer();

    this.container.register(
      INFRA_TOKENS.EventSystem,
      () => new EventSystem(this.logger),
      'singleton',
    );

    this.container.register(
      INFRA_TOKENS.CommunicationBus,
      () =>
        new CommunicationBus(this.logger, {
          commandTimeoutMs: config.infrastructure.commandTimeoutMs,
          maxRetryAttempts: config.infrastructure.maxRetryAttempts,
          retryBackoffBaseMs: config.infrastructure.retryBackoffBaseMs,
        }),
      'singleton',
    );

    this.container.register(
      INFRA_TOKENS.CapabilityRegistry,
      (c) => new CapabilityRegistry(this.logger, c.resolve(INFRA_TOKENS.EventSystem)),
      'singleton',
    );

    this.container.register(
      INFRA_TOKENS.HealthMonitor,
      (c) =>
        new HealthMonitor(
          this.logger,
          c.resolve(INFRA_TOKENS.EventSystem),
          config.infrastructure.maxConsecutiveFailures,
        ),
      'singleton',
    );

    this.container.register(
      INFRA_TOKENS.AgentManager,
      (c) =>
        new AgentManager(
          this.logger,
          c.resolve(INFRA_TOKENS.HealthMonitor),
          c.resolve(INFRA_TOKENS.EventSystem),
        ),
      'singleton',
    );

    this.eventSystem = this.container.resolve(INFRA_TOKENS.EventSystem);
    this.communicationBus = this.container.resolve(INFRA_TOKENS.CommunicationBus);
    this.capabilityRegistry = this.container.resolve(INFRA_TOKENS.CapabilityRegistry);
    this.healthMonitor = this.container.resolve(INFRA_TOKENS.HealthMonitor);
    this.agentManager = this.container.resolve(INFRA_TOKENS.AgentManager);

    this.healthMonitor.startMonitoring(config.infrastructure.healthPollIntervalMs);
    this.logger.info('Core Infrastructure wired', {
      services: [
        'CommunicationBus',
        'EventSystem',
        'CapabilityRegistry',
        'HealthMonitor',
        'AgentManager',
      ],
    });

    // 7. Audio Pipeline Architecture — registered into the *same*
    //    DIContainer instance from step 6, reusing EventSystem and
    //    HealthMonitor. Architecture only: no microphone capture, no
    //    STT/TTS, no wake-word engine exists anywhere here.
    this.container.register(AUDIO_TOKENS.AudioFactory, () => new AudioFactory(), 'singleton');

    this.container.register(
      AUDIO_TOKENS.AudioRouter,
      (c) => new AudioRouter(this.logger, c.resolve(INFRA_TOKENS.EventSystem)),
      'singleton',
    );

    this.container.register(
      AUDIO_TOKENS.AudioManager,
      (c) =>
        new AudioManager(
          this.logger,
          c.resolve(AUDIO_TOKENS.AudioFactory),
          c.resolve(AUDIO_TOKENS.AudioRouter),
          {
            bufferCapacity: config.audio.bufferCapacity,
            maxConcurrentSessions: config.audio.maxConcurrentSessions,
          },
          c.resolve(INFRA_TOKENS.HealthMonitor),
          c.resolve(INFRA_TOKENS.EventSystem),
        ),
      'singleton',
    );

    this.audioFactory = this.container.resolve(AUDIO_TOKENS.AudioFactory);
    this.audioRouter = this.container.resolve(AUDIO_TOKENS.AudioRouter);
    this.audioManager = this.container.resolve(AUDIO_TOKENS.AudioManager);

    this.logger.info('Audio Pipeline Architecture wired', {
      services: ['AudioManager', 'AudioRouter', 'AudioFactory'],
    });

    // 8. Voice Provider (M3.1) / Speech-to-Text (M3.2) / Wake Word (M3.3)
    //    Architecture — each registers a provider registry, a factory,
    //    and a top-level Manager class that implements the *existing*
    //    Milestone 4.0 provider interface (IVoiceManager / ISpeechManager
    //    / IWakeWordManager respectively). This is the integration
    //    boundary between M3.1–3.3 and M4.0: no duplicate interfaces, no
    //    duplicate managers — VoiceRuntimeManager.ts itself is untouched.
    //    No concrete provider (real TTS/STT/wake-word engine) is
    //    registered into any of these registries anywhere in this
    //    project — see docs/MILESTONE_3_1_VOICE_PROVIDER_ARCHITECTURE.md,
    //    MILESTONE_3_2_SPEECH_TO_TEXT_ARCHITECTURE.md, and
    //    MILESTONE_3_3_WAKE_WORD_ARCHITECTURE.md.
    this.container.register(
      WAKE_WORD_TOKENS.WakeWordProviderRegistry,
      () => new WakeWordProviderRegistry(this.logger),
      'singleton',
    );
    this.container.register(
      WAKE_WORD_TOKENS.WakeWordProviderFactory,
      () => new WakeWordProviderFactory(),
      'singleton',
    );
    this.container.register(
      WAKE_WORD_TOKENS.WakeWordManager,
      (c) =>
        new WakeWordManager(
          this.logger,
          c.resolve(WAKE_WORD_TOKENS.WakeWordProviderRegistry),
          c.resolve(WAKE_WORD_TOKENS.WakeWordProviderFactory).createProfile({
            wakeWordPhrase: config.wakeWord.defaultWakeWord,
            sensitivity: config.wakeWord.sensitivity,
            confidenceThreshold: config.wakeWord.confidenceThreshold,
            cooldownMs: config.wakeWord.cooldownMs,
            secureWakeLevel: config.wakeWord.secureWakeEnabled ? 'elevated' : 'standard',
          }),
          c.resolve(AUDIO_TOKENS.AudioRouter),
        ),
      'singleton',
    );

    this.container.register(
      SPEECH_TOKENS.SpeechProviderRegistry,
      () => new SpeechProviderRegistry(this.logger),
      'singleton',
    );
    this.container.register(
      SPEECH_TOKENS.SpeechProviderFactory,
      () => new SpeechProviderFactory(),
      'singleton',
    );
    this.container.register(
      SPEECH_TOKENS.SpeechManager,
      (c) =>
        new SpeechManager(
          this.logger,
          c.resolve(SPEECH_TOKENS.SpeechProviderRegistry),
          c.resolve(SPEECH_TOKENS.SpeechProviderFactory),
          {
            defaultLanguage: config.speechToText.defaultLanguage,
            autoDetectLanguage: config.speechToText.autoDetectLanguage,
          },
          c.resolve(AUDIO_TOKENS.AudioRouter),
        ),
      'singleton',
    );

    this.container.register(
      VOICE_PROVIDER_TOKENS.VoiceProviderRegistry,
      () => new VoiceProviderRegistry(this.logger),
      'singleton',
    );
    this.container.register(
      VOICE_PROVIDER_TOKENS.VoiceProviderFactory,
      () => new VoiceProviderFactory(),
      'singleton',
    );
    this.container.register(
      VOICE_PROVIDER_TOKENS.VoiceManager,
      (c) =>
        new VoiceManager(
          this.logger,
          c.resolve(VOICE_PROVIDER_TOKENS.VoiceProviderRegistry),
          c.resolve(VOICE_PROVIDER_TOKENS.VoiceProviderFactory).createProfile({
            gender: config.voiceProvider.defaultGender,
            language: config.voiceProvider.defaultLanguage,
            providerId: config.voiceProvider.preferredProviderId,
          }),
          c.resolve(AUDIO_TOKENS.AudioRouter),
        ),
      'singleton',
    );

    this.wakeWordManager = this.container.resolve(WAKE_WORD_TOKENS.WakeWordManager);
    this.speechManager = this.container.resolve(SPEECH_TOKENS.SpeechManager);
    this.voiceManager = this.container.resolve(VOICE_PROVIDER_TOKENS.VoiceManager);

    this.logger.info('Voice Provider / Speech-to-Text / Wake Word architecture wired', {
      services: ['WakeWordManager', 'SpeechManager', 'VoiceManager'],
    });

    // 9. Voice Runtime Framework — connects AudioManager (step 7) and the
    //    Wake Word / Speech-to-Text / Voice Provider managers (step 8)
    //    into one runtime pipeline, on top of
    //    CommunicationBus/EventSystem/HealthMonitor (step 6).
    //    `VoiceRuntimeManager` itself is completely unmodified from its
    //    Milestone 4.0 implementation — only the values passed into its
    //    already-optional constructor dependencies changed, here in the
    //    composition root.
    this.container.register(
      VOICE_RUNTIME_TOKENS.VoiceRuntimeFactory,
      () => new VoiceRuntimeFactory(),
      'singleton',
    );

    this.container.register(
      VOICE_RUNTIME_TOKENS.VoiceRuntimeManager,
      (c) =>
        new VoiceRuntimeManager(
          this.logger,
          {
            audioManager: c.resolve(AUDIO_TOKENS.AudioManager),
            factory: c.resolve(VOICE_RUNTIME_TOKENS.VoiceRuntimeFactory),
            communicationBus: c.resolve(INFRA_TOKENS.CommunicationBus),
            eventSystem: c.resolve(INFRA_TOKENS.EventSystem),
            healthMonitor: c.resolve(INFRA_TOKENS.HealthMonitor),
            wakeWordManager: c.resolve(WAKE_WORD_TOKENS.WakeWordManager),
            speechManager: c.resolve(SPEECH_TOKENS.SpeechManager),
            voiceManager: c.resolve(VOICE_PROVIDER_TOKENS.VoiceManager),
          },
          {
            defaultSessionTimeoutMs: config.voiceRuntime.defaultSessionTimeoutMs,
            maxRetryAttempts: config.voiceRuntime.maxRetryAttempts,
            retryBackoffBaseMs: config.voiceRuntime.retryBackoffBaseMs,
          },
        ),
      'singleton',
    );

    this.voiceRuntimeFactory = this.container.resolve(VOICE_RUNTIME_TOKENS.VoiceRuntimeFactory);
    this.voiceRuntimeManager = this.container.resolve(VOICE_RUNTIME_TOKENS.VoiceRuntimeManager);
    await this.voiceRuntimeManager.initialize();

    this.logger.info('Voice Runtime Framework wired', {
      services: ['VoiceRuntimeManager', 'VoiceRuntimeFactory'],
    });

    // 10. AI Brain + executable agents. Compose the M5-M9 layer here so
    // the implementation is part of the actual running application.
    const commandRunner = new ShellCommandRunner();
    const actionAgents = new ActionAgentRegistry(this.logger);
    const permissionManager = new PermissionManager(this.logger, 'admin');
    const memoryManager = new MemoryManager(
      this.logger,
      new SqliteMemoryRepository(this.databaseManager.getConnection()),
    );
    memoryManager.initialize();

    actionAgents.register(new SystemAgent(this.logger, commandRunner));
    actionAgents.register(new FileAgent(this.logger, commandRunner));
    actionAgents.register(new BrowserAgent(this.logger, commandRunner));
    actionAgents.register(
      new CodingAgent(this.logger, commandRunner, { workspaceRoot: this.rootDir }),
    );
    actionAgents.register(new MemoryAgent(this.logger, memoryManager));
    actionAgents.register(new OfficeAgent(this.logger, commandRunner));
    actionAgents.register(new VisionAgent(this.logger, commandRunner));

    // Stage 7: personal integrations. Credentials are encrypted with Electron
    // safeStorage (Windows DPAPI) under userData; OAuth stays in this process.
    this.integrationManager = createIntegrations({
      logger: this.logger,
      dataDir: path.join(app.getPath('userData'), 'integrations'),
      cipher: new ElectronSafeStorageCipher(safeStorage),
      openExternal: (url) => shell.openExternal(url),
      env,
    });
    this.logger.info('Integration data directory', { dir: path.join(app.getPath('userData'), 'integrations') });
    actionAgents.register(new IntegrationAgent(this.logger, this.integrationManager));

    this.container.register(AGENT_TOKENS.CommandRunner, () => commandRunner, 'singleton');
    this.container.register(AGENT_TOKENS.ActionAgentRegistry, () => actionAgents, 'singleton');
    this.container.register(SECURITY_TOKENS.PermissionManager, () => permissionManager, 'singleton');
    this.container.register(MEMORY_TOKENS.MemoryManager, () => memoryManager, 'singleton');
    this.container.register(BRAIN_TOKENS.RulesEngine, () => new RulesEngine(this.logger), 'singleton');
    this.container.register(BRAIN_TOKENS.TaskPlanner, () => new TaskPlanner(), 'singleton');
    this.container.register(
      BRAIN_TOKENS.ActionExecutor,
      (c) =>
        new ActionExecutor(
          this.logger,
          c.resolve(AGENT_TOKENS.ActionAgentRegistry),
          c.resolve(SECURITY_TOKENS.PermissionManager),
        ),
      'singleton',
    );
    this.container.register(
      AI_TOKENS.ToolRegistry,
      () => new ToolRegistry(this.logger, actionAgents, permissionManager),
      'singleton',
    );
    this.container.register(
      AI_TOKENS.Orchestrator,
      () => this.buildAIOrchestrator(config, env),
      'singleton',
    );
    this.container.register(
      BRAIN_TOKENS.CloudReasoner,
      (c) => c.resolve(AI_TOKENS.Orchestrator),
      'singleton',
    );
    this.container.register(
      BRAIN_TOKENS.BrainManager,
      (c) =>
        new BrainManager(
          this.logger,
          c.resolve(BRAIN_TOKENS.RulesEngine),
          c.resolve(BRAIN_TOKENS.TaskPlanner),
          c.resolve(BRAIN_TOKENS.ActionExecutor),
          c.resolve(MEMORY_TOKENS.MemoryManager),
          c.resolve(BRAIN_TOKENS.CloudReasoner),
        ),
      'singleton',
    );
    this.brainManager = this.container.resolve(BRAIN_TOKENS.BrainManager);
    this.aiOrchestrator = this.container.resolve(AI_TOKENS.Orchestrator);

    this.logger.info('AI Brain and agents wired', {
      agents: actionAgents.listAgents().map((agent) => agent.id),
      actions: actionAgents.listActions(),
      permissionRole: permissionManager.getRole(),
    });

    // 11. IPC foundation — registration itself lives in ipc/registerIpc.ts.
    this.ipcRouter = new IpcRouter(this.logger);
    registerIpc(this.ipcRouter, this.configManager, this.brainManager, this.aiOrchestrator, this.integrationManager);

    // 12. Main window (creation is deferred — see createWindow()).
    // The preload is compiled by the backend build into dist/preload.js.
    // Using the compiled preload in both dev and production keeps the
    // renderer bridge compatible with Electron's preload loader.
    this.logger.info(`${config.app.name} starting`, { environment: config.app.environment });
  }

  private initializeWindowManager(config: AppConfig): void {
    if (this.windowManager) return;
    const preloadPath = config.app.environment === 'development'
      ? path.join(this.rootDir, 'app', 'backend', 'src', 'preload.cjs')
      : path.join(this.rootDir, 'app', 'backend', 'dist', 'preload.cjs');
    this.logger.debug('Resolved preload path', { preloadPath });
    this.windowManager = new WindowManager(
      config,
      this.logger,
      preloadPath,
      path.join(this.rootDir, 'app', 'frontend', 'dist'),
    );
  }

  createWindow(): void {
    this.windowManager.createMainWindow();
  }

  hasOpenWindows(): boolean {
    return this.windowManager.getMainWindow() !== null;
  }

  shutdown(): void {
    void this.voiceRuntimeManager?.dispose();
    void this.audioManager?.dispose();
    this.healthMonitor?.stopMonitoring();
    this.ipcRouter?.dispose();
    this.databaseManager?.close();
    this.logger?.info('Application shutting down');
  }

  getLogger(): ILogger {
    return this.logger;
  }

  getContainer(): IDIContainer {
    return this.container;
  }

  getCommunicationBus(): ICommunicationBus {
    return this.communicationBus;
  }

  getEventSystem(): IEventSystem {
    return this.eventSystem;
  }

  getCapabilityRegistry(): ICapabilityRegistry {
    return this.capabilityRegistry;
  }

  getHealthMonitor(): IHealthMonitor {
    return this.healthMonitor;
  }

  getAgentManager(): IAgentManager {
    return this.agentManager;
  }

  getAudioManager(): IAudioManager {
    return this.audioManager;
  }

  getAudioRouter(): IAudioRouter {
    return this.audioRouter;
  }

  getAudioFactory(): IAudioFactory {
    return this.audioFactory;
  }

  getWakeWordManager(): IWakeWordManager {
    return this.wakeWordManager;
  }

  getSpeechManager(): ISpeechManager {
    return this.speechManager;
  }

  getVoiceManager(): IVoiceManager {
    return this.voiceManager;
  }

  getVoiceRuntimeManager(): IVoiceRuntimeManager {
    return this.voiceRuntimeManager;
  }

  getVoiceRuntimeFactory(): IVoiceRuntimeFactory {
    return this.voiceRuntimeFactory;
  }

  getAIOrchestrator(): AIOrchestrator {
    return this.aiOrchestrator;
  }

  /**
   * Composes the M5.1 AI Orchestration layer: registers every configured
   * cloud provider adapter (OpenAI/Gemini/Claude) plus the LocalProvider
   * placeholder, wires health/routing/fallback/context/usage, and returns
   * a single `AIOrchestrator` that satisfies `ICloudReasoner`.
   *
   * Provider secrets are read directly from `AppEnv` here and nowhere
   * else — they are never merged into `AppConfig` (see `IConfigManager`),
   * so `config:getAll` can never leak them to the renderer.
   */
  private buildAIOrchestrator(config: AppConfig, env: AppEnv): AIOrchestrator {
    const registry = new ProviderRegistry(this.logger);
    const health = new ProviderHealthManager(this.logger);

    const openai = new OpenAIProvider(this.logger, {
      apiKey: env.openaiApiKey ?? '',
      model: config.ai.providers.openai.model,
      baseUrl: config.ai.providers.openai.baseUrl,
      timeoutMs: config.ai.providers.openai.timeoutMs,
    });
    const gemini = new GeminiProvider(this.logger, {
      apiKey: env.geminiApiKey ?? '',
      model: config.ai.providers.gemini.model,
      baseUrl: config.ai.providers.gemini.baseUrl,
      timeoutMs: config.ai.providers.gemini.timeoutMs,
      modelDiscoveryEnabled: config.ai.providers.gemini.modelDiscoveryEnabled,
    });
    const claude = new ClaudeProvider(this.logger, {
      apiKey: env.anthropicApiKey ?? '',
      model: config.ai.providers.claude.model,
      baseUrl: config.ai.providers.claude.baseUrl,
      timeoutMs: config.ai.providers.claude.timeoutMs,
      maxTokens: config.ai.providers.claude.maxTokens,
      workspaceId: env.anthropicWorkspaceId,
    });
    // Stage 6 / V7.2: Groq / OpenRouter / Lovable AI Gateway. Each is one
    // more candidate in the existing ProviderRegistry/Router/FallbackManager
    // — none of them replace or reorder how OpenAI/Gemini/Claude already work.
    const groq = new GroqProvider(this.logger, {
      apiKey: env.groqApiKey ?? '',
      model: config.ai.providers.groq.model,
      baseUrl: config.ai.providers.groq.baseUrl,
      timeoutMs: config.ai.providers.groq.timeoutMs,
    });
    const openrouter = new OpenRouterProvider(this.logger, {
      apiKey: env.openrouterApiKey ?? '',
      model: config.ai.providers.openrouter.model,
      baseUrl: config.ai.providers.openrouter.baseUrl,
      timeoutMs: config.ai.providers.openrouter.timeoutMs,
    });
    const lovable = new LovableProvider(this.logger, {
      apiKey: env.lovableApiKey ?? '',
      model: config.ai.providers.lovable.model,
      baseUrl: config.ai.providers.lovable.baseUrl,
      timeoutMs: config.ai.providers.lovable.timeoutMs,
    });
    const local = new LocalProvider();

    registry.register(openai);
    registry.register(gemini);
    registry.register(claude);
    registry.register(groq);
    registry.register(openrouter);
    registry.register(lovable);
    registry.register(local);

    // A stale *_ENABLED=false in an older .env must not silently disable a
    // provider once the user has supplied its API key. Presence of a real
    // key therefore activates that provider; an explicit enabled=true also
    // activates it (and is still harmless when no key is configured).
    const openaiEnabled = config.ai.providers.openai.enabled || Boolean(env.openaiApiKey);
    const geminiEnabled = config.ai.providers.gemini.enabled || Boolean(env.geminiApiKey);
    const claudeEnabled = config.ai.providers.claude.enabled || Boolean(env.anthropicApiKey);
    const groqEnabled = config.ai.providers.groq.enabled || Boolean(env.groqApiKey);
    const openrouterEnabled = config.ai.providers.openrouter.enabled || Boolean(env.openrouterApiKey);
    const lovableEnabled = config.ai.providers.lovable.enabled || Boolean(env.lovableApiKey);
    if (!openaiEnabled) health.markDisabled(openai.id);
    if (!geminiEnabled) health.markDisabled(gemini.id);
    if (!claudeEnabled) health.markDisabled(claude.id);
    if (!groqEnabled) health.markDisabled(groq.id);
    if (!openrouterEnabled) health.markDisabled(openrouter.id);
    if (!lovableEnabled) health.markDisabled(lovable.id);

    this.logger.info('AI provider activation', {
      openai: { enabled: openaiEnabled, configured: openai.isConfigured() },
      gemini: { enabled: geminiEnabled, configured: gemini.isConfigured() },
      claude: { enabled: claudeEnabled, configured: claude.isConfigured() },
      groq: { enabled: groqEnabled, configured: groq.isConfigured() },
      openrouter: { enabled: openrouterEnabled, configured: openrouter.isConfigured() },
      lovable: { enabled: lovableEnabled, configured: lovable.isConfigured() },
    });

    const router = new ProviderRouter(registry, health, config.ai.priorities, config.ai.preferredProviderId);
    const usage = new UsageTracker(this.logger);
    const fallback = new FallbackManager(this.logger, registry, router, health, usage);
    const context = new ContextManager({
      maxTurns: config.ai.contextMaxTurns,
      maxChars: config.ai.contextMaxChars,
    });

    this.logger.info('AI Orchestrator wired', {
      providers: registry.list().map((p) => ({ id: p.id, configured: p.isConfigured() })),
      priorities: config.ai.priorities,
    });

    const toolRegistry = this.container?.resolve(AI_TOKENS.ToolRegistry);
    return new AIOrchestrator(this.logger, registry, health, fallback, usage, toolRegistry, context);
  }
}
