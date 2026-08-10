const canManageAllMapMedia = async (user) => {
  if (!user) return false;
  if (canRoleBypassPrivilege(user, 'manage_all_map_media')) return true;
  const row = await dbGet(`SELECT enabled FROM UserPrivileges WHERE user_id=? AND privilege='manage_all_map_media'`, [user.id]);
  return Number(row?.enabled || 0) === 1;
};

const requireMapMediaAccess = requireAnyPrivilege(['view_abearc_map']);
const requireMapMediaUpload = requireAnyPrivilege(['upload_map_media']);
const requireMapMediaLocationReview = requireAnyPrivilege(['review_map_locations', 'manage_all_map_media']);
const requireMapMediaMaintenance = requireAnyPrivilege(['manage_maintenance', 'manage_all_map_media']);

const ensureMapMediaOwnerOrManager = async (req, res, next) => {
  try {
    const row = await dbGet(`SELECT owner_user_id FROM MapMedia WHERE id=?`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Map photo not found.' });
    if (Number(row.owner_user_id) === Number(req.user.id) || await canManageAllMapMedia(req.user)) return next();
    return res.status(403).json({ error: 'You are not allowed to manage this map photo.' });
  } catch (err) {
    return res.status(500).json({ error: 'Map photo authorization failed.' });
  }
};
