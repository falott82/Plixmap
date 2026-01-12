const readline = require('readline');
const crypto = require('crypto');
const { openDb } = require('./db.cjs');
const { hashPassword, isStrongPassword } = require('./auth.cjs');

const getArgValue = (flag) => {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  const withEq = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (withEq) return withEq.split('=').slice(1).join('=');
  return null;
};

const printUsage = () => {
  console.log('Usage: node server/reset-superadmin.cjs [--password <pwd>]');
  console.log('Env: DESKLY_NEW_PASSWORD=<pwd>, DESKLY_DB_PATH=/path/to/deskly.sqlite');
};

const askHidden = (prompt) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = true;
    rl._writeToOutput = function _writeToOutput(stringToWrite) {
      if (rl.stdoutMuted) rl.output.write('*');
      else rl.output.write(stringToWrite);
    };
    rl.question(prompt, (value) => {
      rl.history = rl.history.slice(1);
      rl.stdoutMuted = false;
      rl.output.write('\n');
      rl.close();
      resolve(value);
    });
  });

const promptPassword = async () => {
  const first = await askHidden('New superadmin password: ');
  const second = await askHidden('Confirm password: ');
  if (first !== second) return { ok: false, error: 'Passwords do not match.' };
  if (!isStrongPassword(first)) return { ok: false, error: 'Password is not strong enough.' };
  return { ok: true, password: first };
};

const run = async () => {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  const argPassword = getArgValue('--password');
  const envPassword = process.env.DESKLY_NEW_PASSWORD;
  let password = argPassword || envPassword || '';
  if (!password) {
    if (!process.stdin.isTTY) {
      printUsage();
      console.error('Missing password (use --password or DESKLY_NEW_PASSWORD).');
      process.exit(1);
    }
    const prompted = await promptPassword();
    if (!prompted.ok) {
      console.error(prompted.error);
      process.exit(1);
    }
    password = prompted.password;
  }
  if (!isStrongPassword(password)) {
    console.error('Password is not strong enough.');
    process.exit(1);
  }

  const db = openDb();
  const now = Date.now();
  const { salt, hash } = hashPassword(String(password));
  const row = db.prepare('SELECT id, tokenVersion FROM users WHERE username = ?').get('superadmin');
  if (!row) {
    const id = crypto.randomUUID();
    const defaultPaletteFavoritesJson = JSON.stringify(['real_user', 'user', 'desktop', 'rack']);
    db.prepare(
      `INSERT INTO users (id, username, passwordSalt, passwordHash, tokenVersion, isAdmin, isSuperAdmin, disabled, language, defaultPlanId, mustChangePassword, paletteFavoritesJson, firstName, lastName, phone, email, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 1, 1, 1, 0, 'it', ?, 0, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      'superadmin',
      salt,
      hash,
      'seed-plan-floor-0',
      defaultPaletteFavoritesJson,
      'Super',
      'Admin',
      '',
      'superadmin@deskly.local',
      now,
      now
    );
    console.log('Superadmin user created and password set.');
  } else {
    db.prepare('UPDATE users SET passwordSalt = ?, passwordHash = ?, tokenVersion = ?, mustChangePassword = 0, updatedAt = ? WHERE id = ?').run(
      salt,
      hash,
      Number(row.tokenVersion || 1) + 1,
      now,
      row.id
    );
    console.log('Superadmin password reset. Active sessions were invalidated.');
  }
  db.close();
};

run().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
