import { randomUUID } from 'node:crypto';

/** Generates a message id / correlation id. Centralized so the ID format can change in one place. */
export function generateId(): string {
  return randomUUID();
}
