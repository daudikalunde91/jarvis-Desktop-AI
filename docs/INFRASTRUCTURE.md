# Core Infrastructure

Scope: the enterprise-grade backbone every future JARVIS module (agents,
plugins, voice, vision, memory, ...) will build on. Nothing in this layer
implements AI, voice, vision, memory, automation, or any concrete
agent/plugin — it is transport, registration, lifecycle, and wiring only.

All source lives under `app/backend/src/`:

```
shared/            cross-cutting types, interfaces, errors, constants,
                   utilities, event-name catalog, message contracts,
                   validation, and abstract base classes
infrastructure/    the six modules below
```

---

## 1. Communication Bus

`infrastructure/communication-bus/`

Centralized asynchronous message router. Every message (`command`,
`event`, `response`, `notification`, `error`) shares one envelope
(`IMessage`) with metadata: `id`, `correlationId`, `timestamp`,
`priority`, `source`, optional `timeoutMs` and `retry` bookkeeping.

- **Publish/Subscribe** — `subscribe(channel, handler)` /
  `publishEvent` / `publishNotification` / `publishError`.
- **Command/Response** — `sendCommand(channel, payload, options)`
  returns a `Promise` resolved when a handler calls
  `bus.respond(message, payload)`; internally routed by
  `correlationId`, not by channel subscription.
- **Priority Queue** — `PriorityMessageQueue` orders messages
  critical → high → normal → low, FIFO within a priority tier.
- **Timeouts & Retry Policy** — `sendCommand` retries up to
  `maxAttempts` times with exponential backoff
  (`shared/utilities/backoff.ts`) whenever a `MessageTimeoutError` is
  thrown; defaults come from `AppConfig.infrastructure` (Configuration
  Manager), not hardcoded literals.
- **Validation** — every enqueued message passes through
  `MessageValidator` first; malformed envelopes throw
  `MessageValidationError` before anything is queued.

The bus **never** interprets `payload` — that's the sole responsibility
of whatever publishes or subscribes to a channel.

## 2. Capability Registry

`infrastructure/capability-registry/`

An in-memory catalog keyed by capability `name`. Each `ICapability`
carries: `name`, `version`, `description`, `owner`,
`permissionsRequired`, `priority`, `offlineSupport`, `status`,
`dependencies`, `estimatedExecutionTimeMs`, `category`.

Supports `register`, `unregister` (blocked while another capability
depends on it), `discover(filter)`, `query(name)`, `updateStatus`, and
`getHealthStatus`. Registering, updating, or removing a capability
optionally emits a `SYSTEM_EVENTS.CAPABILITY_REGISTERED` /
`CAPABILITY_UNREGISTERED` event through the injected `IEventSystem` —
the registry itself never runs, schedules, or health-checks anything.

## 3. Agent Manager

`infrastructure/agent-manager/`

Lifecycle infrastructure for anything implementing `IAgentDescriptor`
(`load`, `unload`, `enable`, `disable`, `healthCheck`) — satisfied by
`BaseAgent` subclasses that don't exist yet. Responsibilities:

- `loadAgent` / `unloadAgent` / `enableAgent` / `disableAgent` /
  `restartAgent`
- **Dependency validation** — an agent can only load once every agent
  ID in its `dependencies` is already loaded and `running`; unloading is
  blocked while another loaded agent still depends on it.
- **Health monitoring integration** — on load, each agent is registered
  with the injected `IHealthMonitor` using its own `healthCheck()`; if
  the monitor's failure threshold is exceeded, `AgentManager.restartAgent`
  is invoked as the restart callback.
- Emits `SYSTEM_EVENTS.MODULE_*` events through the injected
  `IEventSystem` for every state transition.

No concrete agent exists — `tests/infrastructure/agent-manager.test.ts`
exercises this with a minimal mock implementing `IAgentDescriptor`.

## 4. Event System

`infrastructure/event-system/`

A lighter-weight, fire-and-forget sibling to the Communication Bus:

- **Categories** — `system`, `application`, `plugin`, `agent`, `user`,
  `internal` (see `shared/types/EventCategory.ts`).
- **Priority** — same-tick events are flushed in priority order via a
  microtask-scheduled batch, mirroring the bus's ordering semantics.
- **Delayed events** — `emitDelayed(event, delayMs)` schedules an
  `emit()` after the delay (capped by
  `INFRASTRUCTURE_DEFAULTS.eventSystem.maxDelayMs`) and returns a cancel
  function.

Unlike the Communication Bus, the Event System has no responses,
timeouts, or retries — it is intentionally simpler, for pure
notification fan-out.

## 5. Health Monitor

`infrastructure/health-monitor/`

Polls every registered module's check function on an interval
(`startMonitoring(intervalMs)` / `stopMonitoring()`), and also supports
on-demand checks (`checkNow`) and external heartbeats (`heartbeat`).
Tracks, per module: `status` (`stopped` / `starting` / `running` /
`restarting` / `failed`), `lastHeartbeat`, `lastCheckedAt`, and
`failureCount`. When `failureCount` reaches `maxConsecutiveFailures`
(configurable per-registration, defaulting from
`AppConfig.infrastructure.maxConsecutiveFailures`), the module's
`onFailureThresholdExceeded` callback is invoked — the Health Monitor
observes and reports; it never restarts anything itself (that stays
Agent Manager's job, keeping the two loosely coupled).

## 6. Dependency Injection Container

`infrastructure/di-container/`

A lightweight, dependency-free DI container:

- **Singleton / Transient / Scoped** lifetimes.
- **Lazy loading** — factories run only on first `resolve()`.
- **Dependency resolution** — factories receive the container itself
  (`(c) => new Foo(c.resolve(Bar))`), so dependency graphs are wired
  without a decorator/reflection system.
- **Circular dependency detection** — a resolution-stack check throws
  `CircularDependencyError` with the full chain instead of overflowing
  the stack.
- **Scopes** — `createScope()` returns a child container; `scoped`
  registrations are cached per-scope and released via `disposeScope()`,
  while `singleton`/`transient` tokens still delegate to the parent.

`bootstrap/AppBootstrapper.ts` uses this container to wire
`CommunicationBus`, `EventSystem`, `CapabilityRegistry`, `HealthMonitor`,
and `AgentManager` as singletons (see `infrastructure/tokens.ts` for the
`InjectionToken`s) — it does not replace the manual composition root,
it is the mechanism the composition root uses for this layer.

---

## Shared Layer

`shared/` — used by every module above, and intended for every future
one:

| Folder | Contents |
|---|---|
| `types/` | `Priority`, `ModuleStatus`, `Lifetime`, `MessageKind`, `EventCategory`, `Token`/`InjectionToken` |
| `interfaces/` | `IMessage*`, `ICapability`, `IEvent`, `IAgentDescriptor`, `IDIContainer`, `IHealthCheckable`, `ILifecycle`, `IDisposable` |
| `errors/` | `InfrastructureError` hierarchy (extends Milestone 1's `AppError`) |
| `constants/` | `INFRASTRUCTURE_DEFAULTS` (fallback-only; real defaults flow through `ConfigManager`) |
| `utilities/` | `generateId` (correlation IDs), `delay`, `exponentialBackoff` |
| `events/` | `SYSTEM_EVENTS` — the well-known event-name catalog |
| `contracts/` | `MessageEnvelope.ts` — factory functions building well-formed message envelopes |
| `validation/` | `MessageValidator` |
| `base/` | `BaseService`, `BaseManager`, `BaseRepository`, `BaseEvent`, `BaseCommand`, `BaseResponse`, `BaseAgent`, `BasePlugin` |

## Base Classes

All eight requested base classes exist in `shared/base/` as abstract
classes with no business logic — see the table above. `BaseManager`
additionally provides a `start()`/`stop()` template method pattern so
future managers share one activation lifecycle.

## Logging & Configuration integration

- Every infrastructure class takes `ILogger` through its constructor and
  never calls `console.*` directly (task 9).
- `CommunicationBus` and `HealthMonitor` accept their tunable defaults
  (timeouts, retry counts, poll interval, failure threshold) through
  their constructors; `AppBootstrapper` supplies these from
  `AppConfig.infrastructure`, which `ConfigManager` resolves the same
  way as every other setting (`defaults -> config/app.config.json ->
  environment variables`) — no module reads `process.env` or the config
  file directly (task 10).

## Testing

`tests/infrastructure/*.test.ts` — 35 tests covering:

| File | Covers |
|---|---|
| `communication-bus.test.ts` | pub/sub delivery + ordering, unsubscribe, command/response, timeout, retry, message validation |
| `capability-registry.test.ts` | register/query/discover, duplicate rejection, dependency-guarded unregister, status updates |
| `agent-manager.test.ts` | load/unload, duplicate load rejection, dependency validation, enable/disable/restart, Health Monitor registration |
| `event-system.test.ts` | emit/on/off, priority ordering, delayed events |
| `health-monitor.test.ts` | check reporting, failure-count tracking + reset, restart-threshold callback, heartbeat, interval start/stop |
| `di-container.test.ts` | transient vs. singleton vs. scoped resolution, `registerValue`, dependency resolution, missing-token error, circular-dependency detection |

Run with `npm run test`. All 38 tests (3 pre-existing Milestone 1 smoke
tests + 35 new) pass; `npm run typecheck`, `npm run lint`, and `npm run build`
were also re-verified after every change in this milestone.
