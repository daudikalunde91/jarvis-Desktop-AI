import { AudioBufferError } from '@backend/audio/errors/AudioError';

/**
 * Bounded, in-memory-only FIFO buffer. This is the entirety of "Audio
 * Buffer" for this milestone: a generic, capacity-limited queue with no
 * disk persistence of any kind. When full, the oldest chunk is dropped
 * rather than growing unbounded — a deliberate privacy + memory
 * guarantee (see docs/AUDIO_SESSION_GUIDE.md).
 */
export class AudioBufferQueue<T> {
  private items: T[] = [];

  constructor(private readonly capacity: number) {
    if (capacity <= 0) {
      throw new AudioBufferError(`AudioBufferQueue capacity must be > 0, got ${capacity}`);
    }
  }

  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.capacity) {
      this.items.shift();
    }
  }

  drain(): T[] {
    const drained = this.items;
    this.items = [];
    return drained;
  }

  peekAll(): readonly T[] {
    return this.items;
  }

  get size(): number {
    return this.items.length;
  }

  get isFull(): boolean {
    return this.items.length >= this.capacity;
  }

  /** Explicit privacy operation: discards all buffered data immediately. */
  clear(): void {
    this.items = [];
  }
}
