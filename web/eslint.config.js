import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default [
  js.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-else-return': ['error', { allowElseIf: false }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'max-depth': ['error', 3],
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    // Runes need `let`: `let { x } = $props()` and `let count = $state(0)` are
    // compiler syntax, not reassignment. prefer-const cannot tell the
    // difference, so it is off inside components only.
    files: ['**/*.svelte', '**/*.svelte.js'],
    rules: { 'prefer-const': 'off' },
  },
  {
    ignores: ['.svelte-kit/', 'build/', 'coverage/', 'playwright-report/', 'test-results/'],
  },
];
