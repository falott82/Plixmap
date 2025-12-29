// Some deployment templates run `node ./dbsetup.cjs` before starting the server.
// Deskly doesn't require a setup step, but we ensure data directories exist and (when available)
// we prefer storing the SQLite DB on a mounted volume (e.g. `/data`) so data survives restarts.

const fs = require('fs');
const path = require('path');

const ensureDir = (p) => {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch {
    // ignore
  }
};

const safeSymlinkDir = (from, to) => {
  try {
    if (!fs.existsSync(from)) return;
    if (fs.existsSync(to)) return;
    ensureDir(path.dirname(to));
    fs.symlinkSync(from, to, 'dir');
  } catch {
    // ignore
  }
};

// Common volume mount
ensureDir('/data');

// Default app data dir (when running in containers)
ensureDir('/app/data');

// If we have a volume, prefer it by symlinking /app/data -> /data (only if /app/data doesn't already exist as a dir).
try {
  const st = fs.lstatSync('/app/data');
  if (st.isDirectory() && fs.readdirSync('/app/data').length === 0) {
    // Keep existing dir if non-empty; otherwise, replace with symlink.
    fs.rmdirSync('/app/data');
    safeSymlinkDir('/data', '/app/data');
  }
} catch {
  safeSymlinkDir('/data', '/app/data');
}
