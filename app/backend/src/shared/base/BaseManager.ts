import { BaseService } from '@backend/shared/base/BaseService';

/**
 * A Manager owns a resource or subsystem with an explicit start/stop
 * lifecycle (as opposed to a stateless BaseService). Concrete managers
 * (CommunicationBus, AgentManager, HealthMonitor, ...) extend this.
 */
export abstract class BaseManager extends BaseService {
  private started = false;

  get isStarted(): boolean {
    return this.started;
  }

  async start(): Promise<void> {
    if (this.started) return;
    await this.onStart();
    this.started = true;
    this.logger.info(`${this.serviceName} started`);
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    await this.onStop();
    this.started = false;
    this.logger.info(`${this.serviceName} stopped`);
  }

  protected abstract onStart(): void | Promise<void>;
  protected abstract onStop(): void | Promise<void>;
}
