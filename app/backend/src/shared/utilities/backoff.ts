/** Simple exponential backoff: baseMs * 2^(attempt - 1). */
export function exponentialBackoff(attempt: number, baseMs: number): number {
  return baseMs * Math.pow(2, Math.max(0, attempt - 1));
}
