import type { IMessage } from '@backend/shared/interfaces/IMessage';
import { priorityWeight } from '@backend/shared/types/Priority';

/**
 * FIFO-within-priority queue. Higher priority messages are dequeued
 * first; messages of equal priority preserve arrival order. A simple
 * sorted-insert array is used deliberately — the foundation milestone
 * favors a readable, easily-tested implementation over a binary heap.
 */
export class PriorityMessageQueue {
  private items: IMessage[] = [];

  enqueue(message: IMessage): void {
    const weight = priorityWeight(message.metadata.priority);
    let insertAt = this.items.length;

    for (let i = 0; i < this.items.length; i++) {
      if (priorityWeight(this.items[i].metadata.priority) < weight) {
        insertAt = i;
        break;
      }
    }

    this.items.splice(insertAt, 0, message);
  }

  dequeue(): IMessage | undefined {
    return this.items.shift();
  }

  peek(): IMessage | undefined {
    return this.items[0];
  }

  get size(): number {
    return this.items.length;
  }

  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  clear(): void {
    this.items = [];
  }
}
