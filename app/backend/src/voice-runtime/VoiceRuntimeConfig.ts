/**
 * The subset of `AppConfig.voiceRuntime` (Configuration Manager)
 * VoiceRuntimeManager needs. Defined here — not imported from
 * `config/IConfigManager.ts` — so this module stays decoupled from the
 * config module's shape, matching `audio/AudioManagerConfig.ts`.
 * `AppBootstrapper` is the only place that maps one onto the other.
 */
export interface VoiceRuntimeConfig {
  defaultSessionTimeoutMs: number;
  maxRetryAttempts: number;
  retryBackoffBaseMs: number;
}
