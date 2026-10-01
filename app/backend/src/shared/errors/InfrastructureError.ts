import { AppError } from '@backend/core/errors/AppError';

/**
 * Base class for every error thrown by the Core Infrastructure layer
 * (Communication Bus, Capability Registry, Agent Manager, Event System,
 * Health Monitor, DI Container). Extends the same `AppError` used by
 * Milestone 1 so `ErrorHandler` continues to work unchanged.
 */
export class InfrastructureError extends AppError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, true, context);
  }
}

export class CommunicationBusError extends InfrastructureError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'COMMUNICATION_BUS_ERROR', context);
  }
}

export class MessageValidationError extends InfrastructureError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'MESSAGE_VALIDATION_ERROR', context);
  }
}

export class MessageTimeoutError extends InfrastructureError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'MESSAGE_TIMEOUT_ERROR', context);
  }
}

export class CapabilityRegistryError extends InfrastructureError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CAPABILITY_REGISTRY_ERROR', context);
  }
}

export class AgentManagerError extends InfrastructureError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AGENT_MANAGER_ERROR', context);
  }
}

export class EventSystemError extends InfrastructureError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'EVENT_SYSTEM_ERROR', context);
  }
}

export class HealthMonitorError extends InfrastructureError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'HEALTH_MONITOR_ERROR', context);
  }
}

export class DIContainerError extends InfrastructureError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DI_CONTAINER_ERROR', context);
  }
}

export class CircularDependencyError extends DIContainerError {
  constructor(chain: string[]) {
    super(`Circular dependency detected: ${chain.join(' -> ')}`, { chain });
  }
}
