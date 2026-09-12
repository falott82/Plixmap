// App-settings + logs-metadata key/value store extracted from index.cjs.
// Thin DB-backed helpers over the app_settings table, plus the logs-cleared
// metadata bookkeeping. Built as a factory so the db handle is injected.

const createAppSettingsStore = ({ db }) => {
  const readLogsMeta = () => {
    try {
      const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('logsMeta');
      if (!row?.value) return {};
      return JSON.parse(row.value) || {};
    } catch {
      return {};
    }
  };

  const resolveUsername = (userId) => {
    if (!userId) return null;
    try {
      return db.prepare('SELECT username FROM users WHERE id = ?').get(userId)?.username || null;
    } catch {
      return null;
    }
  };

  const setAppSetting = (key, value) => {
    const now = Date.now();
    try {
      db.prepare(
        `INSERT INTO app_settings (key, value, updatedAt) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt`
      ).run(key, String(value), now);
    } catch {
      // ignore
    }
  };

  const getAppSetting = (key) => {
    try {
      return db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key)?.value || null;
    } catch {
      return null;
    }
  };

  const writeLogsMeta = (next) => {
    setAppSetting('logsMeta', JSON.stringify(next));
  };

  const markLogsCleared = (kind, userId, username) => {
    const meta = readLogsMeta();
    const resolved = username || resolveUsername(userId);
    meta[kind] = { clearedAt: Date.now(), userId: userId || null, username: resolved || null };
    writeLogsMeta(meta);
    return meta;
  };

  return { readLogsMeta, resolveUsername, setAppSetting, getAppSetting, writeLogsMeta, markLogsCleared };
};

module.exports = { createAppSettingsStore };
