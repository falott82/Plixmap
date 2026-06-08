// Flat ESLint config focused on React Hooks correctness.
//
// The project's primary type gate is `tsc --noEmit` (npm run lint). This config
// adds a *non-blocking-by-default* hooks linter whose findings are all WARNINGS,
// so it never breaks the build on its own. CI enforces a decreasing
// `--max-warnings` baseline (see package.json "lint:eslint:ci") to ratchet the
// count down over time without a big-bang cleanup.
//
// Priority rules per the warning-reduction plan (docs/frontend/eslint-warning-plan.md):
//   1. react-hooks/set-state-in-effect  — setState called synchronously in an effect
//   2. react-hooks/exhaustive-deps      — missing/incorrect effect dependencies
// react-hooks/rules-of-hooks is included because its findings are genuine bugs.

import reactHooks from 'eslint-plugin-react-hooks';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'data/**', 'release-data/**', 'public/**', 'e2e/**']
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    // @typescript-eslint is registered (rules left off) only so the existing
    // inline `// eslint-disable ... @typescript-eslint/*` directives resolve to a
    // known rule instead of erroring. The active gate is the react-hooks rules.
    plugins: { 'react-hooks': reactHooks, '@typescript-eslint': tsPlugin },
    linterOptions: {
      reportUnusedDisableDirectives: 'off'
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      }
    },
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/exhaustive-deps': 'warn'
    }
  }
];
