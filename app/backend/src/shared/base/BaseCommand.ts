import { generateId } from '@backend/shared/utilities/generateId';

/** Convenience base for typed commands sent through the Communication Bus. */
export abstract class BaseCommand<TPayload = unknown> {
  public readonly correlationId: string;
  public readonly timestamp: number;

  protected constructor(
    public readonly name: string,
    public readonly payload: TPayload,
  ) {
    this.correlationId = generateId();
    this.timestamp = Date.now();
  }
}
