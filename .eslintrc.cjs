/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: false,
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  env: {
    node: true,
    es2022: true,
    browser: true,
  },
  ignorePatterns: ['node_modules', 'dist', 'dist-electron', 'build', 'out', 'release', '*.cjs'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'ignore',
      },
    ],
    'import/no-named-as-default-member': 'off',
    'import/no-named-as-default': 'off',
    // False-positives with esModuleInterop default exports (react, dotenv, ...);
    // TypeScript's own type-checking already guarantees these imports are correct.
    'import/default': 'off',
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: [
          './tsconfig.base.json',
          './app/backend/tsconfig.json',
          './app/frontend/tsconfig.json',
        ],
      },
      node: true,
    },
  },
};
