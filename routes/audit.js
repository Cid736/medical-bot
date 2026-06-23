const express = require('express');
const db      = require('../db');
const { requireAuth, requirePerm } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requirePerm('auditoria.ver'), (req, res) => {
  const limit      = Math.min(Number(req.query.limit) || 100, 500);
  const offset     = Number(req.query.offset) || 0;
  const entityType = req.query.entity_type || null;
  const username   = req.query.username    || null;
  const logs  = db.getAuditLogs(limit, offset, entityType, username);
  const total = db.countAuditLogs(entityType, username);
  return res.json({ logs, total, limit, offset });
});

router.get('/:entityType/:entityId', requireAuth, requirePerm('auditoria.ver'), (req, res) =>
  res.json(db.getAuditLogsByEntity(req.params.entityType, req.params.entityId))
);

module.exports = router;
