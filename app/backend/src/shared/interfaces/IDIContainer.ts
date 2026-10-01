import type { Lifetime } from '@backend/shared/types/Lifetime';
import type { Token } from '@backend/shared/types/Token';

export type Factory<T> = (container: IDIContainer) => T;

export interface IDIContainer {
  register<T>(token: Token<T>, factory: Factory<T>, lifetime?: Lifetime): void;
  registerValue<T>(token: Token<T>, value: T): void;
  resolve<T>(token: Token<T>): T;
  has(token: Token<unknown>): boolean;
  createScope(): IScopedDIContainer;
}

export interface IScopedDIContainer extends IDIContainer {
  disposeScope(): void;
}
