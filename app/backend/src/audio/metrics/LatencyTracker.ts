/**
 * Rolling latency sample tracker. Structural performance instrumentation
 * only — it records durations callers give it; it never measures real
 * hardware or codec latency, since no such processing exists yet.
 */
export class LatencyTracker {
  private samples: number[] = [];

  constructor(private readonly maxSamples: number = 500) {}

  record(latencyMs: number): void {
    this.samples.push(latencyMs);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  get count(): number {
    return this.samples.length;
  }

  get average(): number | null {
    if (this.samples.length === 0) return null;
    const sum = this.samples.reduce((acc, value) => acc + value, 0);
    return sum / this.samples.length;
  }

  get max(): number | null {
    return this.samples.length === 0 ? null : Math.max(...this.samples);
  }

  get min(): number | null {
    return this.samples.length === 0 ? null : Math.min(...this.samples);
  }

  reset(): void {
    this.samples = [];
  }
}
