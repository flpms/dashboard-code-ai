import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      // 'latest' is required for import attributes (`with { type: 'json' }`).
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // The house style, as lint rules. See .claude/skills/code-style/SKILL.md
      // for the reasoning behind each one.
      'no-else-return': ['error', { allowElseIf: false }],
      'no-var': 'error',
      'prefer-const': 'error',
      // Mutation is a bug by default. The exceptions are the two places where
      // it is the interface: a Fastify hook decorating `request`, and a
      // reducer/indexer writing into the accumulator it was handed.
      'no-param-reassign': [
        'error',
        { props: true, ignorePropertyModificationsFor: ['request', 'acc', 'target'] },
      ],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'max-depth': ['error', 3],
      complexity: ['warn', 10],
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['scripts/**/*.js', 'tests/**/*.js'],
    rules: { 'no-console': 'off' },
  },
  {
    ignores: ['node_modules/', 'coverage/', 'logs/', 'data/'],
  },
];
