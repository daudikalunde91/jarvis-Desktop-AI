import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@backend': path.resolve(__dirname, 'app/backend/src'),
      '@config': path.resolve(__dirname, 'config'),
    },
  },
});
