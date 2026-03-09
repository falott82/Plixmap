const test = require('node:test');
const assert = require('node:assert/strict');
const events = require('events');
const https = require('https');

const {
  fetchDevicesFromApi,
  getImportConfig,
  readResponseText,
  resolveEffectiveWebApiConfig,
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

test('validateImportUrl returns a concrete address for direct IP hosts', async () => {
  const result = await validateImportUrl('https://127.0.0.1/path', { allowPrivate: true });
  assert.equal(result.ok, true);
  assert.equal(result.hostname, '127.0.0.1');
  assert.equal(result.address, '127.0.0.1');
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

test('fetchDevicesFromApi uses https transport and parses uppercase Devices payload', async () => {
  const originalRequest = https.request;
  const calls = [];
  https.request = (options, callback) => {
    calls.push({ options });
    const res = new events.EventEmitter();
    res.statusCode = 200;
    res.headers = { 'content-type': 'application/json' };
    process.nextTick(() => {
      callback(res);
      res.emit('data', Buffer.from('{"Devices":[{"dev_id":"1","device_name":"AR-BI-NB002"}]}', 'utf8'));
      res.emit('end');
    });
    return {
      setTimeout() {},
      on() {},
      write() {},
      end() {}
    };
  };

  try {
    const result = await fetchDevicesFromApi({
      url: 'https://127.0.0.1/CEGLabels/Devices',
      username: 'deskly',
      password: 'top-secret',
      method: 'POST',
      bodyJson: '{}',
      allowPrivate: true
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
    assert.deepEqual(result.devices, [
      {
        devId: '1',
        deviceType: '',
        deviceName: 'AR-BI-NB002',
        manufacturer: '',
        model: '',
        serialNumber: ''
      }
    ]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
    assert.equal(calls[0].options.hostname, '127.0.0.1');
    assert.equal(calls[0].options.servername, undefined);
    assert.match(calls[0].options.headers.Authorization, /^Basic /);
  } finally {
    https.request = originalRequest;
  }
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

test('resolveEffectiveWebApiConfig merges live form values with saved password', () => {
  const result = resolveEffectiveWebApiConfig(
    {
      url: 'https://api.example.com/devices',
      username: 'deskly',
      password: 'stored-secret',
      method: 'POST',
      bodyJson: '{}'
    },
    {
      url: ' https://labels.cegelettronica.com/CEGLabels/Devices ',
      username: ' test.user ',
      method: 'post',
      bodyJson: '{}'
    }
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.config, {
    url: 'https://labels.cegelettronica.com/CEGLabels/Devices',
    username: 'test.user',
    password: 'stored-secret',
    method: 'POST',
    bodyJson: '{}'
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
