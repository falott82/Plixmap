const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getImportConfig,
  readResponseText,
  upsertImportConfig,
  updateExternalUser,
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

const createExternalUsersDb = (seedRows = []) => {
  const rows = new Map(seedRows.map((row) => [`${row.clientId}:${row.externalId}`, { ...row }]));
  return {
    prepare(sql) {
      if (sql.includes('SELECT clientId, externalId, firstName, lastName, role, dept1, dept2, dept3, email, mobile, ext1, ext2, ext3, isExternal, hidden, present, lastSeenAt, createdAt, updatedAt')) {
        return {
          get(clientId, externalId) {
            return rows.get(`${clientId}:${externalId}`) || null;
          }
        };
      }
      if (sql.includes('SELECT externalId, firstName, lastName, email FROM external_users WHERE clientId = ?')) {
        return {
          all(clientId) {
            return Array.from(rows.values()).filter((row) => row.clientId === clientId);
          }
        };
      }
      if (sql.includes('UPDATE external_users') && sql.includes('WHERE clientId=? AND externalId=?')) {
        return {
          run(firstName, lastName, role, dept1, dept2, dept3, email, mobile, ext1, ext2, ext3, isExternal, updatedAt, clientId, externalId) {
            const key = `${clientId}:${externalId}`;
            const prev = rows.get(key);
            rows.set(key, {
              ...prev,
              clientId,
              externalId,
              firstName,
              lastName,
              role,
              dept1,
              dept2,
              dept3,
              email,
              mobile,
              ext1,
              ext2,
              ext3,
              isExternal,
              present: 1,
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

test('updateExternalUser edits imported users in the local container and normalizes fields', () => {
  const db = createExternalUsersDb([
    {
      clientId: 'c1',
      externalId: 'ldap:mrossi',
      firstName: 'MARIO',
      lastName: 'ROSSI',
      role: 'IT',
      dept1: 'TECH',
      dept2: '',
      dept3: '',
      email: 'mario.rossi@example.com',
      mobile: '+393331234567',
      ext1: '',
      ext2: '',
      ext3: '',
      isExternal: 0,
      hidden: 0,
      present: 1,
      lastSeenAt: 0,
      createdAt: 1,
      updatedAt: 1
    }
  ]);

  const updated = updateExternalUser(db, 'c1', 'ldap:mrossi', {
    firstName: 'Mario',
    lastName: 'Verdi',
    role: 'Facility manager',
    dept1: 'operations',
    email: 'M.Verdi@Example.com',
    mobile: '+39 333 000 1111'
  });

  assert.equal(updated.externalId, 'ldap:mrossi');
  assert.equal(updated.firstName, 'MARIO');
  assert.equal(updated.lastName, 'VERDI');
  assert.equal(updated.role, 'FACILITY MANAGER');
  assert.equal(updated.dept1, 'OPERATIONS');
  assert.equal(updated.email, 'm.verdi@example.com');
  assert.equal(updated.mobile, '+393330001111');
});
