const fs = require('fs');
const path = require('path');

const DEFAULT_BACKUP_RETENTION = 20;

const normalizeRetention = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_BACKUP_RETENTION;
  return Math.max(1, Math.min(365, Math.round(parsed)));
};

const resolveBackupDir = () => process.env.DESKLY_BACKUP_DIR || path.join(process.cwd(), 'data', 'backups');
const resolveBackupRetention = () => normalizeRetention(process.env.DESKLY_BACKUP_KEEP || DEFAULT_BACKUP_RETENTION);

const ensureBackupDir = () => {
  const dir = resolveBackupDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const formatStamp = (timestamp = Date.now()) => {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(
    date.getUTCMinutes()
  )}${pad(date.getUTCSeconds())}`;
};

const listBackups = () => {
  const dir = ensureBackupDir();
  const files = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sqlite'))
    .map((entry) => {
      const fullPath = path.join(dir, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        fileName: entry.name,
        fullPath,
        sizeBytes: Number(stat.size || 0),
        createdAt: Number(stat.birthtimeMs || stat.mtimeMs || 0) || Date.now(),
        updatedAt: Number(stat.mtimeMs || 0) || Date.now()
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return files;
};

const pruneOldBackups = () => {
  const keep = resolveBackupRetention();
  const backups = listBackups();
  if (backups.length <= keep) return [];
  const removed = [];
  for (const stale of backups.slice(keep)) {
    try {
      fs.rmSync(stale.fullPath, { force: true });
      fs.rmSync(`${stale.fullPath}.meta.json`, { force: true });
      removed.push(stale.fileName);
    } catch {
      // ignore prune errors
    }
  }
  return removed;
};

const createDatabaseBackup = async (db, options = {}) => {
  const dir = ensureBackupDir();
  const stamp = formatStamp();
  const prefix = String(options.prefix || 'deskly').replace(/[^a-zA-Z0-9_-]+/g, '-');
  const fileName = `${prefix}-${stamp}.sqlite`;
  const tmpPath = path.join(dir, `${fileName}.tmp`);
  const finalPath = path.join(dir, fileName);

  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    // best-effort
  }

  try {
    await db.backup(tmpPath);
    fs.renameSync(tmpPath, finalPath);
  } catch (error) {
    try {
      fs.rmSync(tmpPath, { force: true });
    } catch {}
    throw error;
  }

  const stat = fs.statSync(finalPath);
  const metadata = {
    fileName,
    sizeBytes: Number(stat.size || 0),
    createdAt: Date.now(),
    reason: String(options.reason || 'manual')
  };
  try {
    fs.writeFileSync(`${finalPath}.meta.json`, JSON.stringify(metadata, null, 2), 'utf8');
  } catch {
    // ignore sidecar write errors
  }

  const pruned = pruneOldBackups();
  return {
    ...metadata,
    fullPath: finalPath,
    backupDir: dir,
    pruned
  };
};

module.exports = {
  createDatabaseBackup,
  listBackups,
  pruneOldBackups,
  resolveBackupDir,
  resolveBackupRetention
};
