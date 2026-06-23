const express = require('express');
const db      = require('../db');
const { requireAuth, requirePerm, invalidatePermCache } = require('../middleware/auth');
const { audit } = require('../services/audit');

const router = express.Router();

// ── Roles ─────────────────────────────────────────────────────────────────────

router.get('/roles', requireAuth, requirePerm('roles.ver'), (_req, res) => {
  const roles = db.getRoles();
  return res.json(roles.map(r => ({
    ...r,
    permissions: db.getRolePermissions(r.id).map(p => p.key)
  })));
});

router.post('/roles', requireAuth, requirePerm('roles.gestionar'), (req, res) => {
  const { name, description } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  const existing = db.getRoleByName(name.trim());
  if (existing) return res.status(409).json({ error: 'Ya existe un rol con ese nombre' });
  const result = db.createRole(name.trim(), (description || '').trim());
  audit(req, 'CREATE_ROLE', 'role', result.lastInsertRowid, null, { name: name.trim() });
  return res.status(201).json({ id: result.lastInsertRowid, name: name.trim() });
});

router.put('/roles/:id', requireAuth, requirePerm('roles.gestionar'), (req, res) => {
  const id = Number(req.params.id);
  const { name, description } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  const old = db.getRoleById(id);
  if (!old) return res.status(404).json({ error: 'Rol no encontrado' });
  if (old.is_system) return res.status(403).json({ error: 'Los roles del sistema no se pueden renombrar' });
  db.updateRole(id, name.trim(), (description || '').trim());
  audit(req, 'UPDATE_ROLE', 'role', id, { name: old.name }, { name: name.trim() });
  invalidatePermCache();
  return res.json({ ok: true });
});

router.delete('/roles/:id', requireAuth, requirePerm('roles.gestionar'), (req, res) => {
  const id  = Number(req.params.id);
  const old = db.getRoleById(id);
  if (!old) return res.status(404).json({ error: 'Rol no encontrado' });
  if (old.is_system) return res.status(403).json({ error: 'Los roles del sistema no se pueden eliminar' });
  db.deleteRole(id);
  audit(req, 'DELETE_ROLE', 'role', id, { name: old.name }, null);
  invalidatePermCache();
  return res.json({ ok: true });
});

// ── Role permissions ──────────────────────────────────────────────────────────

router.put('/roles/:id/permissions', requireAuth, requirePerm('roles.gestionar'), (req, res) => {
  const id   = Number(req.params.id);
  const role = db.getRoleById(id);
  if (!role) return res.status(404).json({ error: 'Rol no encontrado' });

  const { permissions } = req.body || {};
  if (!Array.isArray(permissions)) return res.status(400).json({ error: 'permissions debe ser array' });

  const oldPerms = db.getRolePermissions(id).map(p => p.key);
  db.setRolePermissions(id, permissions);
  audit(req, 'SET_PERMISSIONS', 'role', id, { permissions: oldPerms }, { permissions });
  invalidatePermCache();
  return res.json({ ok: true });
});

// ── Permissions catalog ────────────────────────────────────────────────────────

router.get('/permissions', requireAuth, requirePerm('roles.ver'), (_req, res) =>
  res.json(db.getPermissions())
);

// ── Clinics ───────────────────────────────────────────────────────────────────

router.get('/clinics', requireAuth, requirePerm('sistema.clinicas'), (_req, res) =>
  res.json(db.getClinics())
);

router.post('/clinics', requireAuth, requirePerm('sistema.clinicas'), (req, res) => {
  const { name, slug, address, phone, email } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  const result = db.createClinic(name.trim(), (slug || '').trim() || null, address || null, phone || null, email || null);
  audit(req, 'CREATE_CLINIC', 'clinic', result.lastInsertRowid, null, { name });
  return res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/clinics/:id', requireAuth, requirePerm('sistema.clinicas'), (req, res) => {
  const id = Number(req.params.id);
  const { name, address, phone, email } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  db.updateClinic(id, name.trim(), address || null, phone || null, email || null);
  audit(req, 'UPDATE_CLINIC', 'clinic', id, null, { name, address, phone, email });
  return res.json({ ok: true });
});

module.exports = router;
