# Release Data

This folder is for intentional, versioned release snapshots only.

- Runtime instance data under `data/` stays local and must not be tracked.
- If you explicitly need to ship the current SQLite instance with a release, run:

```bash
npm run release:db:export
```

This writes:

- `release-data/plixmap-db-latest.sqlite.gz`

Use this only when you intentionally want the current database snapshot under Git for a release handoff.
