/**
 * Shared lifecycle contract for anything the Agent Manager loads,
 * unloads, enables, disables, or restarts.
 */
export interface ILifecycle {
  load(): void | Promise<void>;
  unload(): void | Promise<void>;
  enable(): void | Promise<void>;
  disable(): void | Promise<void>;
}
