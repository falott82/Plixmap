const isStrictSuperAdmin = (value) => {
  const username = String(value?.username || '').trim().toLowerCase();
  return !!value?.isSuperAdmin && username === 'superadmin';
};

const isAdminLike = (value) => !!value?.isAdmin || isStrictSuperAdmin(value);

module.exports = {
  isAdminLike,
  isStrictSuperAdmin
};
