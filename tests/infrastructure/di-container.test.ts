import { describe, expect, it } from 'vitest';

import { DIContainer } from '@backend/infrastructure/di-container/DIContainer';
import {
  DIContainerError,
  CircularDependencyError,
} from '@backend/shared/errors/InfrastructureError';

describe('DIContainer', () => {
  it('resolves a transient registration with a fresh instance every time', () => {
    const container = new DIContainer();
    let counter = 0;
    container.register('counter', () => ({ value: ++counter }), 'transient');

    const first = container.resolve<{ value: number }>('counter');
    const second = container.resolve<{ value: number }>('counter');

    expect(first.value).toBe(1);
    expect(second.value).toBe(2);
  });

  it('resolves a singleton registration to the same instance', () => {
    const container = new DIContainer();
    container.register('service', () => ({ id: Math.random() }), 'singleton');

    const first = container.resolve('service');
    const second = container.resolve('service');

    expect(first).toBe(second);
  });

  it('registerValue() shortcuts a pre-built singleton', () => {
    const container = new DIContainer();
    const value = { hello: 'world' };
    container.registerValue('config', value);

    expect(container.resolve('config')).toBe(value);
  });

  it('resolves dependencies between registrations lazily', () => {
    const container = new DIContainer();
    container.register('a', () => 'value-a', 'singleton');
    container.register('b', (c) => `b depends on ${c.resolve('a')}`, 'singleton');

    expect(container.resolve('b')).toBe('b depends on value-a');
  });

  it('throws for an unregistered token', () => {
    const container = new DIContainer();
    expect(() => container.resolve('missing')).toThrow(DIContainerError);
  });

  it('detects circular dependencies', () => {
    const container = new DIContainer();
    container.register('x', (c) => c.resolve('y'));
    container.register('y', (c) => c.resolve('x'));

    expect(() => container.resolve('x')).toThrow(CircularDependencyError);
  });

  it('scoped registrations are cached per-scope, not globally', () => {
    const container = new DIContainer();
    let counter = 0;
    container.register('scoped-thing', () => ({ id: ++counter }), 'scoped');

    expect(() => container.resolve('scoped-thing')).toThrow(DIContainerError);

    const scopeA = container.createScope();
    const scopeB = container.createScope();

    const a1 = scopeA.resolve<{ id: number }>('scoped-thing');
    const a2 = scopeA.resolve<{ id: number }>('scoped-thing');
    const b1 = scopeB.resolve<{ id: number }>('scoped-thing');

    expect(a1).toBe(a2);
    expect(a1).not.toBe(b1);
  });

  it('a scope still resolves parent singletons', () => {
    const container = new DIContainer();
    container.register('shared-singleton', () => ({ id: Math.random() }), 'singleton');

    const scope = container.createScope();
    expect(scope.resolve('shared-singleton')).toBe(container.resolve('shared-singleton'));
  });
});
