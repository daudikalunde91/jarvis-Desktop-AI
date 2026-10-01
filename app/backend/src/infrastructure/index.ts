/**
 * Core Infrastructure barrel. Every future feature module should depend
 * on these interfaces (ICommunicationBus, ICapabilityRegistry,
 * IAgentManager, IEventSystem, IHealthMonitor, IDIContainer) rather than
 * constructing infrastructure services itself.
 */
export * from '@backend/infrastructure/communication-bus';
export * from '@backend/infrastructure/capability-registry';
export * from '@backend/infrastructure/agent-manager';
export * from '@backend/infrastructure/event-system';
export * from '@backend/infrastructure/health-monitor';
export * from '@backend/infrastructure/di-container';
