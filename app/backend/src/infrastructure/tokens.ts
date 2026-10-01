import { InjectionToken } from '@backend/shared/types/Token';
import type { ICommunicationBus } from '@backend/infrastructure/communication-bus';
import type { IEventSystem } from '@backend/infrastructure/event-system';
import type { ICapabilityRegistry } from '@backend/infrastructure/capability-registry';
import type { IHealthMonitor } from '@backend/infrastructure/health-monitor';
import type { IAgentManager } from '@backend/infrastructure/agent-manager';

/**
 * DI Container tokens for the Core Infrastructure singletons. Future
 * modules resolve these from the shared container instead of
 * constructing infrastructure services themselves.
 */
export const INFRA_TOKENS = {
  CommunicationBus: new InjectionToken<ICommunicationBus>('CommunicationBus'),
  EventSystem: new InjectionToken<IEventSystem>('EventSystem'),
  CapabilityRegistry: new InjectionToken<ICapabilityRegistry>('CapabilityRegistry'),
  HealthMonitor: new InjectionToken<IHealthMonitor>('HealthMonitor'),
  AgentManager: new InjectionToken<IAgentManager>('AgentManager'),
} as const;
