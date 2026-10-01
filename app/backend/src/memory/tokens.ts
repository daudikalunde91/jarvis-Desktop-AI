import { InjectionToken } from '@backend/shared/types/Token';
import type { MemoryManager } from '@backend/memory/MemoryManager';

export const MEMORY_TOKENS = {
  MemoryManager: new InjectionToken<MemoryManager>('MemoryManager'),
} as const;
