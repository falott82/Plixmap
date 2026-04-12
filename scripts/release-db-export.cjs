#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { createServerConfig } = require('../server/config.cjs');

const ROOT = process.cwd();
const SNAPSHOT_DIR = path.join(ROOT, 'release-data');
const SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, 'plixmap-db-latest.sqlite.gz');

const main = () => {
  const { dbPath } = createServerConfig(process.env, { cwd: ROOT });
  const resolvedDbPath = path.resolve(dbPath);
  if (!fs.existsSync(resolvedDbPath)) {
    console.error(`[plixmap] release DB export failed: database not found at ${resolvedDbPath}`);
    process.exit(1);
  }

  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const raw = fs.readFileSync(resolvedDbPath);
  const gz = zlib.gzipSync(raw, { level: zlib.constants.Z_BEST_COMPRESSION });
  fs.writeFileSync(SNAPSHOT_PATH, gz);

  console.log(
    JSON.stringify(
      {
        ok: true,
        dbPath: resolvedDbPath,
        snapshotPath: SNAPSHOT_PATH,
        sizeBytes: gz.length
      },
      null,
      2
    )
  );
};

main();
