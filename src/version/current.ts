// Single source of truth for the running app version. Kept as a plain string so
// every consumer (login screen, footer, update check) can read it without pulling
// the full release-notes history (~190 KB of source) into the entry bundle.
// `npm run release:check` verifies it matches package.json, README and the
// newest entry in src/version/history/partRecent.ts.
export const APP_VERSION = '3.7.0';
