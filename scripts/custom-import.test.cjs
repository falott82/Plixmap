const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getImportConfig,
  readResponseText,
  upsertImportConfig,
  validateImportUrl
} = require('../server/customImport.cjs');

const createImportConfigDb = () => {
  const rows = new Map();
  return {
    prepare(sql) {
      if (sql.includes('SELECT clientId, url, username, passwordEnc, method, bodyJson FROM client_user_import')) {
        return {
          get(clientId) {
            return rows.get(String(clientId)) || null;
          }
        };
      }
      if (sql.includes('SELECT clientId, url, username, passwordEnc, method, bodyJson, updatedAt FROM client_user_import')) {
        return {
          get(clientId) {
            return rows.get(String(clientId)) || null;
          }
        };
      }
      if (sql.includes('SELECT passwordEnc, bodyJson, method FROM client_user_import')) {
        return {
          get(clientId) {
            const row = rows.get(String(clientId)) || null;
            if (!row) return null;
            return {
              passwordEnc: row.passwordEnc,
              bodyJson: row.bodyJson,
              method: row.method
            };
          }
        };
      }
      if (sql.includes('INSERT INTO client_user_import')) {
        return {
          run(clientId, url, username, passwordEnc, method, bodyJson, updatedAt) {
            rows.set(String(clientId), {
              clientId: String(clientId),
              url,
              username,
              passwordEnc,
              method,
              bodyJson,
              updatedAt
            });
            return { changes: 1 };
          }
        };
      }
      throw new Error(`Unsupported SQL in test: ${sql}`);
    }
  };
};

test('validateImportUrl rejects IPv4-mapped loopback hosts when private imports are disabled', async () => {
  const result = await validateImportUrl('http://[::ffff:127.0.0.1]/employees', { allowPrivate: false });
  assert.deepEqual(result, { ok: false, error: 'Host not allowed' });
});

test('readResponseText enforces byte limits for non-stream utf8 responses', async () => {
  const result = await readResponseText(
    {
      headers: { get: () => null },
      body: null,
      text: async () => '€€€'
    },
    5
  );

  assert.deepEqual(result, { ok: false, error: 'Response too large' });
});

test('upsertImportConfig preserves encrypted password when omitted on update', () => {
  const db = createImportConfigDb();
  const authSecret = Buffer.from('test-secret').toString('base64');

  const first = upsertImportConfig(db, authSecret, {
    clientId: 'c1',
    url: 'https://api.example.com/employees',
    username: 'deskly',
    password: 'top-secret',
    method: 'POST',
    bodyJson: '{"page":1}'
  });
  const second = upsertImportConfig(db, authSecret, {
    clientId: 'c1',
    url: 'https://api.example.com/employees?v=2',
    username: 'deskly',
    method: 'GET'
  });
  const resolved = getImportConfig(db, authSecret, 'c1');

  assert.equal(first.hasPassword, true);
  assert.equal(second.hasPassword, true);
  assert.deepEqual(resolved, {
    clientId: 'c1',
    url: 'https://api.example.com/employees?v=2',
    username: 'deskly',
    password: 'top-secret',
    method: 'GET',
    bodyJson: '{"page":1}'
  });
});
