const db = require('../db');

function audit(req, action, entityType, entityId, oldData, newData) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
    db.createAuditLog(
      req.user?.userId,
      req.user?.username || 'system',
      req.user?.role,
      action,
      entityType,
      entityId,
      oldData,
      newData,
      ip
    );
  } catch (_) {}
}

module.exports = { audit };
