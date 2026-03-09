const test = require('node:test');
const assert = require('node:assert/strict');

const { getLdapImportConfig, upsertLdapImportConfig } = require('../server/customImport/configStore.cjs');

const createLdapConfigDb = () => {
  const rows = new Map();
  return {
    prepare(sql) {
      if (sql.includes('SELECT clientId, server, port, security, authType, domain, username, passwordEnc')) {
        return {
          get(clientId) {
            return rows.get(String(clientId)) || null;
          }
        };
      }
      if (sql.includes('SELECT passwordEnc FROM client_ldap_import')) {
        return {
          get(clientId) {
            const row = rows.get(String(clientId)) || null;
            return row ? { passwordEnc: row.passwordEnc } : null;
          }
        };
      }
      if (sql.includes('INSERT INTO client_ldap_import')) {
        return {
          run(
            clientId,
            server,
            port,
            security,
            authType,
            domain,
            username,
            passwordEnc,
            baseDn,
            userFilter,
            scope,
            emailAttribute,
            firstNameAttribute,
            lastNameAttribute,
            externalIdAttribute,
            roleAttribute,
            mobileAttribute,
            dept1Attribute,
            sizeLimit,
            updatedAt
          ) {
            rows.set(String(clientId), {
              clientId: String(clientId),
              server,
              port,
              security,
              scope,
              authType,
              domain,
              username,
              passwordEnc,
              baseDn,
              userFilter,
              emailAttribute,
              firstNameAttribute,
              lastNameAttribute,
              externalIdAttribute,
              roleAttribute,
              mobileAttribute,
              dept1Attribute,
              sizeLimit,
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

test('upsertLdapImportConfig preserves encrypted password when omitted on update', () => {
  const db = createLdapConfigDb();
  const authSecret = Buffer.from('test-secret').toString('base64');

  upsertLdapImportConfig(db, authSecret, {
    clientId: 'c1',
    server: 'ldap.example.com',
    port: 636,
    security: 'ldaps',
    scope: 'sub',
    authType: 'simple',
    domain: '',
    username: 'reader',
    password: 'top-secret',
    baseDn: 'DC=example,DC=com',
    userFilter: '(mail=*)',
    emailAttribute: 'mail',
    firstNameAttribute: 'givenName',
    lastNameAttribute: 'sn',
    externalIdAttribute: 'sAMAccountName',
    roleAttribute: 'title',
    mobileAttribute: 'mobile',
    dept1Attribute: 'department',
    sizeLimit: 1000
  });
  upsertLdapImportConfig(db, authSecret, {
    clientId: 'c1',
    server: 'ldap.internal.example.com',
    port: 389,
    security: 'starttls',
    scope: 'one',
    authType: 'domain_user',
    domain: 'EXAMPLE',
    username: 'reader',
    baseDn: 'DC=example,DC=com',
    userFilter: '(mail=*)',
    emailAttribute: 'mail',
    firstNameAttribute: 'givenName',
    lastNameAttribute: 'sn',
    externalIdAttribute: 'sAMAccountName',
    roleAttribute: 'title',
    mobileAttribute: 'mobile',
    dept1Attribute: 'department',
    sizeLimit: 500
  });

  const resolved = getLdapImportConfig(db, authSecret, 'c1');
  assert.equal(resolved.password, 'top-secret');
  assert.equal(resolved.server, 'ldap.internal.example.com');
  assert.equal(resolved.security, 'starttls');
  assert.equal(resolved.scope, 'one');
  assert.equal(resolved.authType, 'domain_user');
  assert.equal(resolved.domain, 'EXAMPLE');
  assert.equal(resolved.username, 'reader');
  assert.equal(resolved.baseDn, 'DC=example,DC=com');
  assert.equal(resolved.sizeLimit, 500);
});
