/**
 * The subset of `AppConfig.audio` (Configuration Manager) AudioManager
 * needs. Defined here — not imported from `config/IConfigManager.ts` —
 * so the audio module stays decoupled from the config module's shape;
 * `AppBootstrapper` is the only place that maps one onto the other.
 */
export interface AudioManagerConfig {
  bufferCapacity: number;
  maxConcurrentSessions: number;
}
