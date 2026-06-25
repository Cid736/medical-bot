const express = require('express');
const crypto  = require('crypto');
const db      = require('../db');
const { requireAuth, requirePerm } = require('../middleware/auth');
const { audit } = require('../services/audit');

const router = express.Router();

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}
function generateSalt() { return crypto.randomBytes(16).toString('hex'); }

router.get('/', requireAuth, requirePerm('usuarios.ver'), (req, res) => {
  const users = db.getAllUsers().map(u => ({
    id: u.id, username: u.username, name: u.name,
    role: u.role, active: u.active, created_at: u.created_at,
    clinic_id: u.clinic_id
  }));
  return res.json(users);
});

router.post('/', requireAuth, requirePerm('usuarios.gestionar'), (req, res) => {
  const VALID_ROLES = ['superadmin', 'admin', 'recepcionista', 'medico', 'readonly'];
  const { username, password, name, role } = req.body || {};
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  const safeRole = role || 'admin';
  if (!VALID_ROLES.includes(safeRole)) return res.status(400).json({ error: `Rol inválido. Válidos: ${VALID_ROLES.join(', ')}` });
  if (db.getUserByUsername(username.trim())) return res.status(409).json({ error: 'El usuario ya existe' });
  const salt = generateSalt();
  db.createUser(username.trim(), hashPassword(password, salt), salt, (name || '').trim() || username.trim(), safeRole);
  audit(req, 'CREATE_USER', 'user', username.trim(), null, { username: username.trim(), name, role });
  return res.status(201).json({ ok: true });
});

router.put('/:id', requireAuth, requirePerm('usuarios.gestionar'), (req, res) => {
  const VALID_ROLES = ['superadmin', 'admin', 'recepcionista', 'medico', 'readonly'];
  const id = Number(req.params.id);
  const { name, role } = req.body || {};
  const safeRole = role || 'admin';
  if (!VALID_ROLES.includes(safeRole)) return res.status(400).json({ error: `Rol inválido. Válidos: ${VALID_ROLES.join(', ')}` });
  db.updateUser(id, (name || '').trim(), safeRole);
  audit(req, 'UPDATE_USER', 'user', id, null, { name, role: safeRole });
  return res.json({ ok: true });
});

router.patch('/:id/password', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  // Superadmin or gestionar-perm can reset anyone; others can only change their own
  const canManage = req.user.role === 'superadmin' ||
    (db.getUserPermissions(req.user.role) || []).includes('usuarios.gestionar');
  if (!canManage && req.user.userId !== id) return res.status(403).json({ error: 'Sin permisos' });
  const { password } = req.body || {};
  if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  const salt = generateSalt();
  db.updateUserPassword(id, hashPassword(password, salt), salt);
  audit(req, 'CHANGE_PASSWORD', 'user', id, null, null);
  return res.json({ ok: true });
});

router.patch('/:id/active', requireAuth, requirePerm('usuarios.gestionar'), (req, res) => {
  const id = Number(req.params.id);
  const { active } = req.body || {};
  db.setUserActive(id, active ? 1 : 0);
  audit(req, active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', 'user', id, null, { active });
  return res.json({ ok: true });
});

module.exports = router;
