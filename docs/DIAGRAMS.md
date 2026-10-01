# Core Infrastructure — Diagrams

Mermaid source, renders directly on GitHub/GitLab or any Mermaid-aware
Markdown viewer.

## Architecture Diagram

Component view: the composition root wires the DI Container, which
constructs the five infrastructure singletons on top of the Shared
Layer.

```mermaid
graph TB
    subgraph MainProcess["Electron Main Process"]
        Bootstrapper["AppBootstrapper<br/>(composition root)"]
    end

    subgraph Infra["Core Infrastructure"]
        DI["DI Container"]
        Bus["Communication Bus"]
        Events["Event System"]
        Registry["Capability Registry"]
        Health["Health Monitor"]
        Agents["Agent Manager"]
    end

    subgraph Shared["Shared Layer"]
        Types["types / interfaces"]
        Errors["errors"]
        Base["base classes"]
        Contracts["contracts / validation"]
        Utils["constants / utilities / events"]
    end

    Bootstrapper -->|constructs & registers| DI
    DI -->|resolve| Bus
    DI -->|resolve| Events
    DI -->|resolve| Registry
    DI -->|resolve| Health
    DI -->|resolve| Agents

    Registry -.emits via.-> Events
    Health -.emits via.-> Events
    Agents -.emits via.-> Events
    Agents -->|registers health checks| Health
    Agents -->|restart callback| Agents

    Bus --> Shared
    Events --> Shared
    Registry --> Shared
    Health --> Shared
    Agents --> Shared

    style Infra fill:#0b0f17,color:#ffffff,stroke:#3fd0ff
    style Shared fill:#111826,color:#ffffff,stroke:#3fd0ff
    style MainProcess fill:#111826,color:#ffffff,stroke:#3fd0ff
```

## Dependency Diagram

Import-direction view: arrows point from a module to what it depends on.
Everything ultimately depends on the Shared Layer; nothing in Shared
depends back on infrastructure.

```mermaid
graph LR
    AppBootstrapper --> DIContainer
    AppBootstrapper --> CommunicationBus
    AppBootstrapper --> EventSystem
    AppBootstrapper --> CapabilityRegistry
    AppBootstrapper --> HealthMonitor
    AppBootstrapper --> AgentManager

    AgentManager --> HealthMonitor
    AgentManager --> EventSystem
    CapabilityRegistry --> EventSystem
    HealthMonitor --> EventSystem

    CommunicationBus --> SharedLayer["Shared Layer<br/>(types/interfaces/errors/contracts/validation/base)"]
    EventSystem --> SharedLayer
    CapabilityRegistry --> SharedLayer
    HealthMonitor --> SharedLayer
    AgentManager --> SharedLayer
    DIContainer --> SharedLayer

    SharedLayer --> Milestone1["Milestone 1 Foundation<br/>(ILogger, AppError, AppConfig)"]

    style SharedLayer fill:#111826,color:#ffffff,stroke:#3fd0ff
    style Milestone1 fill:#0b0f17,color:#ffffff,stroke:#3fd0ff
```

Notes:
- `CommunicationBus` has no dependency on `EventSystem`, `HealthMonitor`,
  or `AgentManager` — it is the one module usable in complete isolation.
- `EventSystem` is a dependency of three other infrastructure modules but
  depends on none of them — an intentional low-level/leaf position.

## Sequence Diagram

Example flow: loading an agent with a dependency, wiring it into the
Health Monitor, and reacting to a health-check failure with an automatic
restart — all infrastructure, no agent behavior implied.

```mermaid
sequenceDiagram
    participant Caller
    participant AM as AgentManager
    participant HM as HealthMonitor
    participant EV as EventSystem
    participant Agent as IAgentDescriptor

    Caller->>AM: loadAgent(agent, { dependencies: ["base"] })
    AM->>AM: validateDependencies("base")
    AM->>Agent: load()
    Agent-->>AM: resolved
    AM->>HM: register(agent.id, agent.healthCheck, onFailureThresholdExceeded)
    AM->>EV: emit(MODULE_LOADED)
    AM-->>Caller: resolved

    Note over HM: startMonitoring(intervalMs) polls on a timer

    HM->>Agent: healthCheck()
    Agent-->>HM: "failed"
    HM->>EV: emit(HEALTH_CHECK_FAILED)
    HM->>HM: failureCount++

    Note over HM: failureCount reaches maxConsecutiveFailures

    HM->>AM: onFailureThresholdExceeded() → restartAgent(agent.id)
    AM->>Agent: disable()
    AM->>Agent: enable()
    AM->>EV: emit(MODULE_RESTARTED)
```
