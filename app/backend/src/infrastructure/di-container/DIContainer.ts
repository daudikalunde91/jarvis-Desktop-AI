import type { Lifetime } from '@backend/shared/types/Lifetime';
import type { Token } from '@backend/shared/types/Token';
import type {
  Factory,
  IDIContainer,
  IScopedDIContainer,
} from '@backend/shared/interfaces/IDIContainer';
import {
  CircularDependencyError,
  DIContainerError,
} from '@backend/shared/errors/InfrastructureError';

interface Registration<T = unknown> {
  factory: Factory<T>;
  lifetime: Lifetime;
}

function tokenLabel(token: Token<unknown>): string {
  return typeof token === 'string' || typeof token === 'symbol' ? String(token) : token.toString();
}

/**
 * Lightweight Dependency Injection container.
 *
 * Supports singleton, transient, and scoped lifetimes; lazy instantiation
 * (factories only run on first `resolve()`); and circular-dependency
 * detection via a resolution-stack check. This container is provided as
 * infrastructure for future agents/plugins to use — it does not replace
 * the manual composition root in `bootstrap/AppBootstrapper.ts`.
 */
export class DIContainer implements IDIContainer {
  protected readonly registrations = new Map<Token<unknown>, Registration>();
  private readonly singletons = new Map<Token<unknown>, unknown>();
  protected readonly resolving = new Set<Token<unknown>>();

  register<T>(token: Token<T>, factory: Factory<T>, lifetime: Lifetime = 'transient'): void {
    this.registrations.set(token, { factory: factory as Factory<unknown>, lifetime });
  }

  registerValue<T>(token: Token<T>, value: T): void {
    this.registrations.set(token, { factory: () => value, lifetime: 'singleton' });
    this.singletons.set(token, value);
  }

  has(token: Token<unknown>): boolean {
    return this.registrations.has(token);
  }

  resolve<T>(token: Token<T>): T {
    const registration = this.registrations.get(token);
    if (!registration) {
      throw new DIContainerError(`No registration found for token "${tokenLabel(token)}"`);
    }

    if (registration.lifetime === 'scoped') {
      throw new DIContainerError(
        `Token "${tokenLabel(token)}" is registered as scoped and must be resolved through container.createScope()`,
      );
    }

    if (registration.lifetime === 'singleton' && this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    const instance = this.instantiate<T>(token, registration);

    if (registration.lifetime === 'singleton') {
      this.singletons.set(token, instance);
    }

    return instance;
  }

  createScope(): IScopedDIContainer {
    return new ScopedDIContainer(this);
  }

  protected instantiate<T>(token: Token<unknown>, registration: Registration): T {
    if (this.resolving.has(token)) {
      const chain = [...this.resolving, token].map(tokenLabel);
      throw new CircularDependencyError(chain);
    }

    this.resolving.add(token);
    try {
      return registration.factory(this) as T;
    } finally {
      this.resolving.delete(token);
    }
  }

  getRegistration(token: Token<unknown>): Registration | undefined {
    return this.registrations.get(token);
  }
}

/**
 * A child container for 'scoped' registrations (e.g. one scope per
 * request/session). Singleton and transient tokens delegate to the
 * parent; scoped tokens are cached only within this scope and released
 * on `disposeScope()`.
 */
class ScopedDIContainer extends DIContainer implements IScopedDIContainer {
  private readonly scopedInstances = new Map<Token<unknown>, unknown>();
  private disposed = false;

  constructor(private readonly parent: DIContainer) {
    super();
  }

  override has(token: Token<unknown>): boolean {
    return this.getRegistration(token) !== undefined || this.parent.has(token);
  }

  override resolve<T>(token: Token<T>): T {
    if (this.disposed) {
      throw new DIContainerError('Cannot resolve from a disposed scope');
    }

    const ownRegistration = this.getRegistration(token);
    const registration = ownRegistration ?? this.parent.getRegistration(token);

    if (!registration) {
      throw new DIContainerError(`No registration found for token "${tokenLabel(token)}"`);
    }

    if (registration.lifetime !== 'scoped') {
      return this.parent.resolve<T>(token);
    }

    if (this.scopedInstances.has(token)) {
      return this.scopedInstances.get(token) as T;
    }

    const instance = this.instantiate<T>(token, registration);
    this.scopedInstances.set(token, instance);
    return instance;
  }

  disposeScope(): void {
    this.scopedInstances.clear();
    this.disposed = true;
  }
}
