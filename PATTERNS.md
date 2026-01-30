# PATTERNS.md
Version: 1.9.2

## Problematic patterns (do not repeat)

- Hook TDZ from declaration order
  - Pattern: `useMemo`/`useCallback`/`useEffect` (or any hook call) depends on a `const` declared later in the component body.
  - Risk: minified builds can throw `ReferenceError: Cannot access '<var>' before initialization`.
  - Prevention: declare referenced values/functions before the hook call; if needed, lift helpers above derived state.

- UI color scattered across files
  - Pattern: the same semantic color value hard-coded in multiple places (layers + drawing + defaults).
  - Risk: inconsistent UI and drift when changes are made.
  - Prevention: define a single source of truth (e.g. `WALL_LAYER_COLOR`) and reuse it.

- Build-only regressions undetected
  - Pattern: errors only appear after `npm run build` because of minification/ordering.
  - Risk: runtime crashes in production.
  - Prevention: run a production build locally before release and keep a small static check for TDZ-like patterns.
