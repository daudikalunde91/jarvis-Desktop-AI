# JARVIS — Naming & Structural Conventions

This document makes explicit the naming convention already in use across
the foundation, so future milestones extend it consistently instead of
introducing new patterns.

## Classes

| Suffix     | Meaning                                                        | Examples                                    |
|------------|-----------------------------------------------------------------|----------------------------------------------|
| `Manager`  | Owns and controls access to a stateful resource                 | `ConfigManager`, `DatabaseManager`, `WindowManager`, `AgentManager` |
| `Handler`  | Reacts to / processes an event or error, no owned resource       | `ErrorHandler`                                |
| `Router`   | Routes messages/requests to registered handlers                  | `IpcRouter`                                   |
| `Bootstrap`/`Bootstrapper` | One-time setup/wiring at startup                 | `FolderBootstrap`, `AppBootstrapper`          |
| `Transport`| Pluggable output/delivery mechanism injected into a Manager       | `ConsoleTransport`, `FileTransport`           |
| `Bus`      | Asynchronous message router (pub/sub + request/response)          | `CommunicationBus`                            |
| `Registry` | Catalog of descriptors; stores and answers queries, doesn't execute | `CapabilityRegistry`                        |
| `System`   | Centralized engine coordinating a specific concern                | `EventSystem`                                 |
| `Monitor`  | Observes and reports state without controlling it                 | `HealthMonitor`                               |
| `Container`| Holds and resolves registrations (DI)                             | `DIContainer`                                 |
| `Factory`  | Centralizes construction of domain objects, injected for testability | `AudioFactory`, `VoiceRuntimeFactory`       |

Feature modules added in later milestones (`brain`, `agents`, `memory`, ...)
should reuse these suffixes rather than inventing new ones. If a future
class doesn't fit cleanly, prefer `Service` for a stateless operation
performed on request (no owned resource, no event reaction).

## Interfaces

Prefixed with `I` and named after the class they abstract:
`ILogger`, `IConfigManager`, `IDatabaseManager`. Interfaces live next to
their primary implementation, not in a separate `interfaces/` tree.

## Files

- One class per file. File name matches the class name exactly
  (`ConfigManager.ts` exports `ConfigManager`).
- Non-class modules (constants, functions, type-only files) use
  camelCase: `constants.ts`, `env.ts`, `channels.ts`, `registerIpc.ts`.
- Barrel/aggregator functions are named `register*` or `create*` and
  describe the action they perform (`registerIpc`, `registerAppLifecycle`).

## Constants

`SCREAMING_SNAKE_CASE` for compile-time constant objects/values
(`APP_METADATA`, `IPC_NAMESPACE`, `RUNTIME_DIRECTORIES`, `LOG_LEVELS`).

## Path aliases

Every workspace package aliases itself as `@<package>/*` pointing at its
own `src/*` (or module root for placeholder folders):
`@backend/*`, `@frontend/*`, `@brain/*`, `@agents/*`, `@communication/*`,
`@voice/*`, `@vision/*`, `@memory/*`, `@awareness/*`, `@security/*`,
`@plugins/*`, plus `@config/*` for the root `config/` directory. No
relative `../../..` imports across module boundaries — always use the
alias.

## Errors

All thrown application errors extend `AppError` and carry a
`SCREAMING_SNAKE_CASE` `code` (e.g. `CONFIG_ERROR`, `DATABASE_ERROR`,
`IPC_ERROR`). New error subclasses go in `core/errors/AppError.ts` next to
the base class until that file's size justifies splitting per-domain.
