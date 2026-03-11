const { registerImportConfigRoutes } = require('./imports/configRoutes.cjs');
const { registerImportWebApiRoutes } = require('./imports/webapiRoutes.cjs');
const { registerImportCsvRoutes } = require('./imports/csvRoutes.cjs');
const { registerImportLdapRoutes } = require('./imports/ldapRoutes.cjs');
const { registerImportPreviewRoutes } = require('./imports/previewRoutes.cjs');

const registerImportRoutes = (app, deps) => {
  const {
    db,
    dataSecret,
    requireAuth,
    rateByUser,
    requestMeta,
    writeAuditLog,
    readState,
    writeState,
    parseCsvRows,
    allowPrivateImportForRequest,
    getImportConfig,
    getDeviceImportConfig,
    getLdapImportConfig,
    getImportConfigSafe,
    getDeviceImportConfigSafe,
    getLdapImportConfigSafe,
    upsertImportConfig,
    upsertDeviceImportConfig,
    upsertLdapImportConfig,
    upsertExternalUsers,
    upsertExternalDevices,
    listImportSummary,
    listDeviceImportSummary,
    resolveEffectiveWebApiConfig,
    fetchEmployeesFromApi,
    fetchDevicesFromApi,
    normalizeExternalUserPayload,
    normalizeExternalDevicePayload,
    normalizeLdapImportConfig,
    resolveLdapEffectiveConfig,
    fetchEmployeesFromLdap,
    prepareLdapImportPreview,
    selectLdapImportRows,
    applyLdapImportOverrides
  } = deps;

  const parseCsvEmployees = (text) => {
    const rows = parseCsvRows(String(text || ''));
    if (!rows.length) return { employees: [], error: 'Empty CSV' };
    const header = rows.shift().map((h) => String(h || '').trim().toLowerCase());
    if (!header.length) return { employees: [], error: 'Missing header' };
    const map = new Map();
    const mapping = {
      externalid: 'externalId',
      firstname: 'firstName',
      lastname: 'lastName',
      role: 'role',
      dept1: 'dept1',
      dept2: 'dept2',
      dept3: 'dept3',
      email: 'email',
      mobile: 'mobile',
      cell: 'mobile',
      cellulare: 'mobile',
      phone: 'mobile',
      telefono: 'mobile',
      numero_cellulare: 'mobile',
      ext1: 'ext1',
      ext2: 'ext2',
      ext3: 'ext3',
      isexternal: 'isExternal'
    };
    header.forEach((key, idx) => {
      const normalized = mapping[key] || null;
      if (normalized) map.set(normalized, idx);
    });
    const employees = [];
    const generatedIds = new Set();
    const compactPhone = (value) => String(value || '').replace(/\s+/g, '').trim();
    const makeCsvExternalId = (base, rowIndex) => {
      const cleaned = String(base || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
      let candidate = `csv:${cleaned || `row-${rowIndex + 1}`}`;
      let suffix = 2;
      while (generatedIds.has(candidate)) {
        candidate = `csv:${cleaned || `row-${rowIndex + 1}`}-${suffix++}`;
      }
      generatedIds.add(candidate);
      return candidate;
    };
    const parseBool = (value) => {
      const v = String(value || '').trim().toLowerCase();
      return v === '1' || v === 'true' || v === 'yes' || v === 'y';
    };
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const get = (key) => {
        const idx = map.get(key);
        if (idx === undefined) return '';
        return String(row[idx] || '').trim();
      };
      const firstName = get('firstName');
      const lastName = get('lastName');
      const email = get('email');
      const explicitExternalId = map.has('externalId') ? get('externalId') : '';
      const externalId =
        explicitExternalId ||
        makeCsvExternalId(email || `${firstName} ${lastName}`.trim() || `row-${rowIndex + 1}`, rowIndex);
      if (!externalId) continue;
      employees.push({
        externalId,
        firstName,
        lastName,
        role: get('role'),
        dept1: get('dept1'),
        dept2: get('dept2'),
        dept3: get('dept3'),
        email,
        mobile: compactPhone(get('mobile')),
        ext1: get('ext1'),
        ext2: get('ext2'),
        ext3: get('ext3'),
        isExternal: parseBool(get('isExternal'))
      });
    }
    return { employees, error: null };
  };
  
  const parseCsvDevices = (text) => {
    const rows = parseCsvRows(String(text || ''));
    if (!rows.length) return { devices: [], error: 'Empty CSV' };
    const header = rows.shift().map((h) => String(h || '').trim().toLowerCase());
    if (!header.length) return { devices: [], error: 'Missing header' };
    const map = new Map();
    const mapping = {
      devid: 'devId',
      dev_id: 'devId',
      deviceid: 'devId',
      device_type: 'deviceType',
      devicetype: 'deviceType',
      type: 'deviceType',
      device_name: 'deviceName',
      devicename: 'deviceName',
      name: 'deviceName',
      manufacturer: 'manufacturer',
      model: 'model',
      serialnumber: 'serialNumber',
      serial_number: 'serialNumber',
      serial: 'serialNumber'
    };
    header.forEach((key, idx) => {
      const normalized = mapping[key] || null;
      if (normalized) map.set(normalized, idx);
    });
    const devices = [];
    const generatedIds = new Set();
    const makeCsvDeviceId = (base, rowIndex) => {
      const cleaned = String(base || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
      let candidate = `csvdev:${cleaned || `row-${rowIndex + 1}`}`;
      let suffix = 2;
      while (generatedIds.has(candidate)) {
        candidate = `csvdev:${cleaned || `row-${rowIndex + 1}`}-${suffix++}`;
      }
      generatedIds.add(candidate);
      return candidate;
    };
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const get = (key) => {
        const idx = map.get(key);
        if (idx === undefined) return '';
        return String(row[idx] || '').trim();
      };
      const deviceName = get('deviceName');
      const serialNumber = get('serialNumber');
      const explicitDeviceId = map.has('devId') ? get('devId') : '';
      const devId = explicitDeviceId || makeCsvDeviceId(serialNumber || deviceName || `row-${rowIndex + 1}`, rowIndex);
      if (!devId) continue;
      devices.push({
        devId,
        deviceType: get('deviceType'),
        deviceName,
        manufacturer: get('manufacturer'),
        model: get('model'),
        serialNumber
      });
    }
    return { devices, error: null };
  };
  
  const clearImportDataForClient = (cid) => {
    const removedUsers = db.prepare('DELETE FROM external_users WHERE clientId = ?').run(cid).changes || 0;
    const state = readState();
    let removedObjects = 0;
    const nextClients = (state.clients || []).map((c) => {
      if (c.id !== cid) return c;
      return {
        ...c,
        sites: (c.sites || []).map((s) => ({
          ...s,
          floorPlans: (s.floorPlans || []).map((p) => {
            const prevCount = (p.objects || []).length;
            const nextObjects = (p.objects || []).filter((o) => !(o.type === 'real_user' && o.externalClientId === cid));
            removedObjects += prevCount - nextObjects.length;
            return { ...p, objects: nextObjects };
          })
        }))
      };
    });
    const payload = { clients: nextClients, objectTypes: state.objectTypes };
    const updatedAt = writeState(payload);
    return { removedUsers, removedObjects, updatedAt };
  };
  
  const clearDeviceImportDataForClient = (cid) => {
    const removedDevices = db.prepare('DELETE FROM external_devices WHERE clientId = ?').run(cid).changes || 0;
    return { removedDevices };
  };
  
  const buildDeviceDeletePlacementInfo = () => ({
    supported: false,
    linkedPlanObjects: 0,
    warning:
      'Imported devices are not structurally tracked on floor plans yet. Deleting them removes only the local inventory row: verify any manual floor-plan placements before continuing.'
  });
  
  const deleteImportedExternalUserForClient = (cid, externalId) => {
    const eid = String(externalId || '').trim();
    if (!cid || !eid) return { removedUsers: 0, removedObjects: 0, updatedAt: null };
    const removedUsers = db.prepare('DELETE FROM external_users WHERE clientId = ? AND externalId = ?').run(cid, eid).changes || 0;
    const state = readState();
    let removedObjects = 0;
    const nextClients = (state.clients || []).map((c) => {
      if (c.id !== cid) return c;
      return {
        ...c,
        sites: (c.sites || []).map((s) => ({
          ...s,
          floorPlans: (s.floorPlans || []).map((p) => {
            const prevCount = (p.objects || []).length;
            const nextObjects = (p.objects || []).filter((o) => !(o.type === 'real_user' && o.externalClientId === cid && String(o.externalUserId || '') === eid));
            removedObjects += prevCount - nextObjects.length;
            return { ...p, objects: nextObjects };
          })
        }))
      };
    });
    const payload = { clients: nextClients, objectTypes: state.objectTypes };
    const updatedAt = writeState(payload);
    return { removedUsers, removedObjects, updatedAt };
  };
  
  const deleteImportedExternalDeviceForClient = (cid, devId) => {
    const cleanup = deleteImportedExternalDevicesForClient(cid, [devId]);
    return {
      removedDevices: cleanup.removedDevices,
      removedIds: cleanup.removedIds,
      missingIds: cleanup.missingIds,
      placementInfo: cleanup.placementInfo
    };
  };
  
  const deleteImportedExternalDevicesForClient = (cid, devIds) => {
    const ids = Array.from(
      new Set(
        (Array.isArray(devIds) ? devIds : [])
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      )
    );
    if (!cid || !ids.length) {
      return { removedDevices: 0, removedIds: [], missingIds: [], placementInfo: buildDeviceDeletePlacementInfo() };
    }
    const removeStmt = db.prepare("DELETE FROM external_devices WHERE clientId = ? AND devId = ? AND lower(devId) NOT LIKE 'manual:%'");
    const removedIds = [];
    const missingIds = [];
    for (const devId of ids) {
      const changes = removeStmt.run(cid, devId).changes || 0;
      if (changes > 0) removedIds.push(devId);
      else missingIds.push(devId);
    }
    return {
      removedDevices: removedIds.length,
      removedIds,
      missingIds,
      placementInfo: buildDeviceDeletePlacementInfo()
    };
  };
  
  const normalizeImportText = (value) => String(value || '').trim();
  const normalizeUpperImportText = (value) => normalizeImportText(value).toUpperCase();
  const normalizeImportPhone = (value) => normalizeImportText(value).replace(/\s+/g, '');
  
  const mapImportedEmployeeForPreview = (employee) => ({
    externalId: String(employee?.externalId || ''),
    firstName: normalizeUpperImportText(employee?.firstName),
    lastName: normalizeUpperImportText(employee?.lastName),
    role: normalizeUpperImportText(employee?.role),
    dept1: normalizeUpperImportText(employee?.dept1),
    dept2: normalizeUpperImportText(employee?.dept2),
    dept3: normalizeUpperImportText(employee?.dept3),
    email: normalizeImportText(employee?.email).toLowerCase(),
    mobile: normalizeImportPhone(employee?.mobile),
    ext1: normalizeUpperImportText(employee?.ext1),
    ext2: normalizeUpperImportText(employee?.ext2),
    ext3: normalizeUpperImportText(employee?.ext3),
    isExternal: !!employee?.isExternal
  });
  
  const mapExternalUserDbRowForPreview = (row, { includeFlags = false } = {}) => ({
    externalId: String(row?.externalId || ''),
    firstName: String(row?.firstName || ''),
    lastName: String(row?.lastName || ''),
    role: String(row?.role || ''),
    dept1: String(row?.dept1 || ''),
    dept2: String(row?.dept2 || ''),
    dept3: String(row?.dept3 || ''),
    email: String(row?.email || ''),
    mobile: String(row?.mobile || ''),
    ext1: String(row?.ext1 || ''),
    ext2: String(row?.ext2 || ''),
    ext3: String(row?.ext3 || ''),
    isExternal: Number(row?.isExternal || 0) === 1,
    ...(includeFlags
      ? {
          hidden: Number(row?.hidden || 0) === 1,
          present: Number(row?.present || 0) === 1,
          updatedAt: row?.updatedAt || null
        }
      : {})
  });
  
  const loadExistingImportPreviewUsers = (clientId) =>
    db
      .prepare(
        'SELECT clientId, externalId, firstName, lastName, role, dept1, dept2, dept3, email, mobile, ext1, ext2, ext3, isExternal, hidden, present, updatedAt FROM external_users WHERE clientId = ? ORDER BY lastName COLLATE NOCASE, firstName COLLATE NOCASE'
      )
      .all(clientId)
      .map((row) => ({
        clientId: String(row.clientId || ''),
        ...mapExternalUserDbRowForPreview(row, { includeFlags: true })
      }));
  
  const resolveLdapRuntimeConfigForRequest = (req) => {
    const cid = String(req.body?.clientId || '').trim();
    if (!cid) {
      return { ok: false, status: 400, error: 'Missing clientId' };
    }
    const saved = getLdapImportConfig(db, dataSecret, cid);
    const draft = req.body?.config && typeof req.body.config === 'object' ? req.body.config : null;
    const normalized = resolveLdapEffectiveConfig({ clientId: cid, savedConfig: saved, draftConfig: draft });
    if (!normalized.ok) {
      return { ok: false, status: 400, error: normalized.error || 'Invalid LDAP configuration' };
    }
    return { ok: true, clientId: cid, config: normalized.config };
  };
  
  const mapImportedDeviceForPreview = (device) => ({
    ...normalizeExternalDevicePayload(device || {})
  });
  
  const mapExternalDeviceDbRowForPreview = (row, { includeFlags = false } = {}) => ({
    devId: String(row?.devId || ''),
    deviceType: String(row?.deviceType || ''),
    deviceName: normalizeExternalDevicePayload(row || {}).deviceName,
    manufacturer: String(row?.manufacturer || ''),
    model: String(row?.model || ''),
    serialNumber: String(row?.serialNumber || ''),
    ...(includeFlags
      ? {
          hidden: Number(row?.hidden || 0) === 1,
          present: Number(row?.present || 0) === 1,
          updatedAt: row?.updatedAt || null
        }
      : {})
  });
  
  const importedUserChangedAgainstRemote = (previous, remoteUser) => {
    if (!previous || !remoteUser) return true;
    return (
      normalizeImportText(previous.firstName) !== normalizeImportText(remoteUser.firstName) ||
      normalizeImportText(previous.lastName) !== normalizeImportText(remoteUser.lastName) ||
      normalizeImportText(previous.role) !== normalizeImportText(remoteUser.role) ||
      normalizeImportText(previous.dept1) !== normalizeImportText(remoteUser.dept1) ||
      normalizeImportText(previous.dept2) !== normalizeImportText(remoteUser.dept2) ||
      normalizeImportText(previous.dept3) !== normalizeImportText(remoteUser.dept3) ||
      normalizeImportText(previous.email) !== normalizeImportText(remoteUser.email) ||
      normalizeImportText(previous.mobile) !== normalizeImportText(remoteUser.mobile) ||
      normalizeImportText(previous.ext1) !== normalizeImportText(remoteUser.ext1) ||
      normalizeImportText(previous.ext2) !== normalizeImportText(remoteUser.ext2) ||
      normalizeImportText(previous.ext3) !== normalizeImportText(remoteUser.ext3) ||
      Number(previous.isExternal || 0) !== (remoteUser.isExternal ? 1 : 0) ||
      Number(previous.present || 1) !== 1
    );
  };
  
  const buildImportedDeviceDiff = (previous, remoteDevice) => {
    if (!previous || !remoteDevice) return [];
    const changes = [];
    const fields = [
      ['deviceName', previous.deviceName, remoteDevice.deviceName],
      ['deviceType', previous.deviceType, remoteDevice.deviceType],
      ['manufacturer', previous.manufacturer, remoteDevice.manufacturer],
      ['model', previous.model, remoteDevice.model],
      ['serialNumber', previous.serialNumber, remoteDevice.serialNumber]
    ];
    for (const [field, before, after] of fields) {
      if (normalizeImportText(before) === normalizeImportText(after)) continue;
      changes.push({
        field,
        previous: String(before || ''),
        next: String(after || '')
      });
    }
    if (Number(previous.present || 1) !== 1) {
      changes.push({
        field: 'present',
        previous: 'missing',
        next: 'present'
      });
    }
    return changes;
  };
  
  const mapRemoteDevicePreviewRow = (remoteDevice, previous) => {
    const normalized = mapImportedDeviceForPreview(remoteDevice);
    if (!previous) {
      return { ...normalized, importStatus: 'new', changes: [] };
    }
    const changes = buildImportedDeviceDiff(previous, normalized);
    return {
      ...normalized,
      importStatus: changes.length ? 'update' : 'existing',
      changes
    };
  };
  

  const routeContext = {
    db,
    dataSecret,
    requireAuth,
    rateByUser,
    requestMeta,
    writeAuditLog,
    readState,
    allowPrivateImportForRequest,
    getImportConfig,
    getDeviceImportConfig,
    getLdapImportConfig,
    getImportConfigSafe,
    getDeviceImportConfigSafe,
    getLdapImportConfigSafe,
    upsertImportConfig,
    upsertDeviceImportConfig,
    upsertLdapImportConfig,
    upsertExternalUsers,
    upsertExternalDevices,
    listImportSummary,
    listDeviceImportSummary,
    resolveEffectiveWebApiConfig,
    fetchEmployeesFromApi,
    fetchDevicesFromApi,
    normalizeExternalUserPayload,
    normalizeExternalDevicePayload,
    normalizeLdapImportConfig,
    resolveLdapEffectiveConfig,
    fetchEmployeesFromLdap,
    prepareLdapImportPreview,
    selectLdapImportRows,
    applyLdapImportOverrides,
    parseCsvEmployees,
    parseCsvDevices,
    clearImportDataForClient,
    clearDeviceImportDataForClient,
    normalizeImportText,
    normalizeUpperImportText,
    normalizeImportPhone,
    mapImportedEmployeeForPreview,
    mapExternalUserDbRowForPreview,
    loadExistingImportPreviewUsers,
    resolveLdapRuntimeConfigForRequest,
    mapImportedDeviceForPreview,
    mapExternalDeviceDbRowForPreview,
    importedUserChangedAgainstRemote,
    buildImportedDeviceDiff,
    mapRemoteDevicePreviewRow,
    deleteImportedExternalUserForClient,
    deleteImportedExternalDeviceForClient,
    deleteImportedExternalDevicesForClient
  };

  registerImportConfigRoutes(app, routeContext);
  registerImportWebApiRoutes(app, routeContext);
  registerImportCsvRoutes(app, routeContext);
  registerImportLdapRoutes(app, routeContext);
  registerImportPreviewRoutes(app, routeContext);

};

module.exports = { registerImportRoutes };
