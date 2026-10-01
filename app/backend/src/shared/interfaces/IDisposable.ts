/** Anything that owns a resource (timers, connections, subscriptions) that must be released. */
export interface IDisposable {
  dispose(): void | Promise<void>;
}
