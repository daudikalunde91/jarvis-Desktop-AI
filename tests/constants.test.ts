import { describe, expect, it } from 'vitest';

import { APP_METADATA, RUNTIME_DIRECTORIES, LOG_LEVELS } from '@backend/core/constants';

describe('core constants', () => {
  it('exposes stable app metadata', () => {
    expect(APP_METADATA.name).toBe('JARVIS');
    expect(typeof APP_METADATA.version).toBe('string');
  });

  it('declares the expected runtime directories', () => {
    expect(Object.values(RUNTIME_DIRECTORIES)).toEqual(
      expect.arrayContaining(['config', 'database', 'logs', 'assets']),
    );
  });

  it('declares log levels in descending severity order', () => {
    expect(LOG_LEVELS).toEqual(['error', 'warn', 'info', 'debug']);
  });
});
