const isStrictSuperAdmin = (value) => {
  const username = String(value?.username || '').trim().toLowerCase();
  return !!value?.isSuperAdmin && username === 'superadmin';
};

const isAdminLike = (value) => !!value?.isAdmin || isStrictSuperAdmin(value);

const requireSuperAdmin = (req, res) => {
  if (req.isSuperAdmin) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
};

module.exports = {
  isAdminLike,
  isStrictSuperAdmin,
  requireSuperAdmin
};
