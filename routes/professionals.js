const express = require('express');
const db      = require('../db');
const { requireAuth, requirePerm } = require('../middleware/auth');
const { audit } = require('../services/audit');

const router = express.Router();

router.get('/', requireAuth, requirePerm('profesionales.ver'), (_req, res) =>
  res.json(db.getProfessionals())
);

router.post('/', requireAuth, requirePerm('profesionales.gestionar'), (req, res) => {
  const { name, specialty } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  const result  = db.addProfessional(name.trim(), (specialty || '').trim() || null);
  const created = db.getProfessionalById(result.lastInsertRowid);
  audit(req, 'CREATE', 'professional', created.id, null, { name: created.name, specialty: created.specialty });
  return res.status(201).json(created);
});

router.put('/:id', requireAuth, requirePerm('profesionales.gestionar'), (req, res) => {
  const id = Number(req.params.id);
  const { name, specialty } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  const old = db.getProfessionalById(id);
  db.updateProfessional(id, name.trim(), (specialty || '').trim() || null);
  audit(req, 'UPDATE', 'professional', id, { name: old?.name, specialty: old?.specialty }, { name: name.trim(), specialty: (specialty || '').trim() || null });
  return res.json({ ok: true });
});

router.delete('/:id', requireAuth, requirePerm('profesionales.gestionar'), (req, res) => {
  const id  = Number(req.params.id);
  const old = db.getProfessionalById(id);
  db.deleteProfessional(id);
  audit(req, 'DELETE', 'professional', id, { name: old?.name }, null);
  return res.json({ ok: true });
});

module.exports = router;
