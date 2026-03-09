const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeLdapImportConfig,
  buildLdapBindIdentity,
  formatLdapError,
  fetchEmployeesFromLdap,
  prepareLdapImportPreview,
  resolveLdapEffectiveConfig,
  selectLdapImportRows,
  applyLdapImportOverrides
} = require('../server/customImport/ldap.cjs');

test('normalizeLdapImportConfig rejects missing base DN and missing domain for domain auth', () => {
  const missingBaseDn = normalizeLdapImportConfig({
    clientId: 'c1',
    server: 'ldap.example.com',
    authType: 'simple',
    username: 'reader'
  });
  const missingDomain = normalizeLdapImportConfig({
    clientId: 'c1',
    server: 'ldap.example.com',
    authType: 'domain_user',
    username: 'reader',
    baseDn: 'DC=example,DC=com'
  });

  assert.equal(missingBaseDn.ok, false);
  assert.match(missingBaseDn.error, /base DN/i);
  assert.equal(missingDomain.ok, false);
  assert.match(missingDomain.error, /domain/i);
});

test('buildLdapBindIdentity supports the configured authentication variants', () => {
  assert.equal(buildLdapBindIdentity({ authType: 'simple', username: 'reader' }), 'reader');
  assert.equal(buildLdapBindIdentity({ authType: 'domain_user', domain: 'EXAMPLE', username: 'reader' }), 'EXAMPLE\\reader');
  assert.equal(buildLdapBindIdentity({ authType: 'user_principal_name', domain: 'example.com', username: 'reader' }), 'reader@example.com');
  assert.equal(buildLdapBindIdentity({ authType: 'anonymous', domain: 'example.com', username: 'reader' }), '');
});

test('fetchEmployeesFromLdap only binds, searches and unbinds while mapping entries', async () => {
  const calls = [];
  const config = {
    clientId: 'c1',
    server: 'ldap.example.com',
    port: 636,
    security: 'ldaps',
    scope: 'one',
    authType: 'simple',
    username: 'reader',
    password: 'secret',
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
  };
  const clientFactory = () => ({
    async bind(identity, password) {
      calls.push(['bind', identity, password]);
    },
    async search(baseDn, options) {
      calls.push(['search', baseDn, options.scope, options.filter, options.attributes]);
      return {
        searchEntries: [
          {
            mail: 'mario.rossi@example.com',
            givenName: 'Mario',
            sn: 'Rossi',
            sAMAccountName: 'mrossi',
            title: 'IT',
            mobile: '+39 333 1234567',
            department: 'Tech'
          }
        ]
      };
    },
    async unbind() {
      calls.push(['unbind']);
    },
    async add() {
      calls.push(['add']);
      throw new Error('unexpected add');
    }
  });

  const result = await fetchEmployeesFromLdap(config, { clientFactory });

  assert.equal(result.ok, true);
  assert.equal(result.returnedCount, 1);
  assert.deepEqual(result.employees[0], {
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
    isExternal: false
  });
  assert.deepEqual(calls, [
    ['bind', 'reader', 'secret'],
    ['search', 'DC=example,DC=com', 'one', '(mail=*)', ['mail', 'givenName', 'sn', 'sAMAccountName', 'title', 'mobile', 'department']],
    ['unbind']
  ]);
});

test('prepareLdapImportPreview compares by email and skips duplicates or missing emails', () => {
  const preview = prepareLdapImportPreview(
    [
      {
        clientId: 'c1',
        externalId: 'manual:1',
        firstName: 'Existing',
        lastName: 'User',
        email: 'existing@example.com'
      }
    ],
    [
      { externalId: 'ldap:a', firstName: 'Anna', lastName: 'Alpha', email: 'new@example.com' },
      { externalId: 'ldap:b', firstName: 'Eva', lastName: 'Existing', email: 'existing@example.com' },
      { externalId: 'ldap:c', firstName: 'No', lastName: 'Mail', email: '' },
      { externalId: 'ldap:d', firstName: 'Dup', lastName: 'One', email: 'dup@example.com' },
      { externalId: 'ldap:e', firstName: 'Dup', lastName: 'Two', email: 'dup@example.com' }
    ]
  );

  assert.equal(preview.importableCount, 1);
  assert.equal(preview.existingCount, 1);
  assert.equal(preview.skippedCount, 4);
  assert.equal(preview.importableRows[0].email, 'new@example.com');
  assert.equal(preview.existingRows[0].email, 'existing@example.com');
  assert.deepEqual(
    preview.skippedRows.map((row) => row.skipReason).sort(),
    ['already_present_email', 'duplicate_email_in_ldap', 'duplicate_email_in_ldap', 'missing_email']
  );
});

test('formatLdapError makes connection failures explicit', () => {
  assert.equal(formatLdapError({ code: 'ENOTFOUND' }), 'LDAP host not found (check server name / DNS)');
  assert.equal(formatLdapError({ message: 'InvalidCredentialsError: 80090308: LdapErr: DSID-0C09050A' }), 'LDAP bind failed: invalid username or password');
});

test('resolveLdapEffectiveConfig prefers current draft values and keeps saved password when omitted', () => {
  const result = resolveLdapEffectiveConfig({
    clientId: 'c1',
    savedConfig: {
      clientId: 'c1',
      server: 'saved.example.com',
      port: 636,
      security: 'ldaps',
      scope: 'sub',
      authType: 'simple',
      username: 'saved-user',
      password: 'saved-secret',
      baseDn: 'DC=example,DC=com',
      userFilter: '(mail=*)',
      emailAttribute: 'mail',
      firstNameAttribute: 'givenName',
      lastNameAttribute: 'sn',
      externalIdAttribute: 'uid',
      roleAttribute: 'title',
      mobileAttribute: 'mobile',
      dept1Attribute: 'department',
      sizeLimit: 1000
    },
    draftConfig: {
      server: 'draft.example.com',
      scope: 'one',
      baseDn: 'OU=People,DC=example,DC=com'
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.config.server, 'draft.example.com');
  assert.equal(result.config.scope, 'one');
  assert.equal(result.config.baseDn, 'OU=People,DC=example,DC=com');
  assert.equal(result.config.password, 'saved-secret');
});

test('selectLdapImportRows imports only the chosen LDAP users and rejects empty selections', () => {
  const importableRows = [
    { externalId: 'ldap:a', firstName: 'Anna', email: 'anna@example.com' },
    { externalId: 'ldap:b', firstName: 'Bruno', email: 'bruno@example.com' }
  ];

  const selected = selectLdapImportRows(importableRows, ['ldap:b']);
  assert.equal(selected.ok, true);
  assert.equal(selected.requestedCount, 1);
  assert.equal(selected.selectedCount, 1);
  assert.deepEqual(selected.rows.map((row) => row.externalId), ['ldap:b']);

  const empty = selectLdapImportRows(importableRows, []);
  assert.equal(empty.ok, false);
  assert.match(empty.error, /No LDAP users selected/i);
});

test('applyLdapImportOverrides merges manual completion fields before import', () => {
  const result = applyLdapImportOverrides(
    [
      {
        externalId: 'ldap:a',
        firstName: 'MARIO',
        lastName: 'ROSSI',
        email: 'mario.rossi@example.com',
        mobile: '',
        role: '',
        dept1: '',
        dept2: '',
        dept3: ''
      }
    ],
    {
      'ldap:a': {
        mobile: '333 12 34 567',
        role: 'tecnico',
        dept1: 'it'
      }
    }
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.rows[0], {
    externalId: 'ldap:a',
    firstName: 'MARIO',
    lastName: 'ROSSI',
    email: 'mario.rossi@example.com',
    mobile: '3331234567',
    role: 'TECNICO',
    dept1: 'IT',
    dept2: '',
    dept3: ''
  });
});
