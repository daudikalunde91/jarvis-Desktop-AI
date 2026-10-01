import type { ILogger } from '@backend/logging/ILogger';

/**
 * Root of every stateless(ish) infrastructure/feature service. Provides
 * nothing but a name and an injected logger — services must never call
 * `console.*` directly, they log through this.
 */
export abstract class BaseService {
  protected constructor(
    protected readonly logger: ILogger,
    public readonly serviceName: string,
  ) {}
}
