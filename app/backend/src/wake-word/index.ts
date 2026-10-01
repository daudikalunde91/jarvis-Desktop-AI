/**
 * Wake Word Architecture (Milestone 3.3) barrel.
 *
 * Architecture only: no real wake-word detection model, no hardware
 * access, no voice biometrics. `WakeWordManager` is the concrete class
 * that satisfies Milestone 4.0's `IWakeWordManager` contract.
 */
export * from '@backend/wake-word/types';
export * from '@backend/wake-word/errors';
export * from '@backend/wake-word/interfaces';
export * from '@backend/wake-word/models';
export * from '@backend/wake-word/WakeWordProviderRegistry';
export * from '@backend/wake-word/WakeWordProviderFactory';
export * from '@backend/wake-word/WakeWordManager';
export * from '@backend/wake-word/tokens';
