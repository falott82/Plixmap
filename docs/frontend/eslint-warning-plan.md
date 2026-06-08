# Frontend ESLint warning-reduction plan

ESLint was a dependency but had **no configuration**, so React Hooks bugs were
never surfaced. `eslint.config.js` now adds a hooks-focused linter. Every rule
is a **warning** (the `tsc --noEmit` gate stays the source of hard errors), and
CI enforces a **decreasing `--max-warnings` baseline** so the count can only go
down, never up — no big-bang cleanup required.

## Current baseline

Captured with `npm run lint:eslint` (snapshot at the time this plan landed):

| Rule                            | Count | Notes                                            |
| ------------------------------- | ----: | ------------------------------------------------ |
| `react-hooks/exhaustive-deps`   |   224 | Missing / incorrect effect dependency arrays     |
| `react-hooks/set-state-in-effect` | 187 | `setState` called synchronously inside an effect |
| `react-hooks/rules-of-hooks`    |     4 | Hooks called conditionally / out of order        |
| **Total**                       | **415** | `--max-warnings 415` in `lint:eslint:ci`       |

## The ratchet

- `package.json` → `lint:eslint:ci` runs `eslint ... --max-warnings <N>` and is
  part of `quality:check` (the CI gate). New warnings push the count above `N`
  and fail CI.
- When you fix warnings, **lower `N`** in `lint:eslint:ci` to the new count in
  the same PR. The number only moves down.
- Local commits are unaffected: the pre-commit hook runs `tsc` + unit tests, not
  ESLint.

## Priority order

1. **`react-hooks/rules-of-hooks` (4)** — genuine bugs; fix first.
2. **`react-hooks/set-state-in-effect` (187)** — drive cascading renders. Fix by:
   - deriving the value during render instead of storing it in state;
   - moving the `setState` into the event handler that caused the change;
   - for "seed state when a modal opens" effects, prefer a `key` reset or an
     initializer over a synchronous `setState`.
3. **`react-hooks/exhaustive-deps` (224)** — correct the dependency array, or
   memoize the offending callback/value with `useCallback`/`useMemo` so the
   dependency is stable. Suppress with a justified inline disable only when the
   effect must intentionally run once.

## Commands

```bash
npm run lint:eslint        # list all warnings
npm run lint:eslint:ci     # enforce the baseline (used by quality:check)
npm run lint:eslint -- --fix   # auto-fix the few mechanically-fixable cases
```
