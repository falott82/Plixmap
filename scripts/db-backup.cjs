#!/usr/bin/env node
const { openDb } = require('../server/db.cjs');
const { createDatabaseBackup } = require('../server/backup.cjs');

const run = async () => {
  const db = openDb();
  try {
    const result = await createDatabaseBackup(db, { reason: 'cli' });
    console.log(
      JSON.stringify(
        {
          ok: true,
          fileName: result.fileName,
          sizeBytes: result.sizeBytes,
          backupDir: result.backupDir,
          pruned: result.pruned
        },
        null,
        2
      )
    );
  } finally {
    try {
      db.close();
    } catch {}
  }
};

run().catch((error) => {
  console.error(`[plixmap] backup failed: ${error?.message || error}`);
  process.exitCode = 1;
});
