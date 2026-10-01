/** Promise-based sleep, used by retry/backoff logic. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
