/** Convenience base for typed responses to a BaseCommand. */
export abstract class BaseResponse<TPayload = unknown> {
  public readonly timestamp: number;

  protected constructor(
    public readonly correlationId: string,
    public readonly success: boolean,
    public readonly payload: TPayload,
  ) {
    this.timestamp = Date.now();
  }
}
