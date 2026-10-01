/**
 * A DI Container registration key.
 *
 * Plain strings/symbols work for simple cases; `InjectionToken<T>` adds a
 * phantom type parameter so `container.resolve(token)` can be statically
 * typed without a manual cast at every call site.
 */
export class InjectionToken<T> {
  // Never assigned — exists purely so TypeScript can infer T at resolve() call sites.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  declare private readonly __type?: T;

  constructor(public readonly description: string) {}

  toString(): string {
    return `InjectionToken(${this.description})`;
  }
}

export type Token<T = unknown> = string | symbol | InjectionToken<T>;
