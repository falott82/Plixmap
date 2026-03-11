const buildPermissionCacheKey = (ctx) => {
  const user = ctx?.user || {};
  const permissions = Array.isArray(ctx?.permissions) ? ctx.permissions : [];

  // Permissions are already fetched in stable order from SQL (scopeType, scopeId).
  // Building the key directly avoids map/sort/join churn on a hot path.
  let permissionKey = '';
  for (let i = 0; i < permissions.length; i += 1) {
    const entry = permissions[i] || {};
    if (i > 0) permissionKey += '|';
    permissionKey += `${String(entry.scopeType || '').trim()}:${String(entry.scopeId || '').trim()}:${String(entry.access || '').trim()}:${entry.chat ? '1' : '0'}`;
  }

  return `${String(user.id || '').trim()}::${user.isAdmin ? 'admin' : 'user'}::${user.isSuperAdmin ? 'super' : 'std'}::${user.isMeetingOperator ? 'meetingop' : 'full'}::${permissionKey}`;
};

module.exports = { buildPermissionCacheKey };
