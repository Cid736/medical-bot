const express  = require('express');
const crypto   = require('crypto');
const db       = require('../db');
const { SESSION_TTL } = require('../sessions');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}
function generateSalt()  { return crypto.randomBytes(16).toString('hex'); }
function generateToken() { return crypto.randomBytes(32).toString('hex'); }

// Seed admin on first run, or promote to superadmin if none exists
function seedAdmin() {
  const users = db.getAllUsers();
  if (!users.length) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'cme2024!';
    const salt     = generateSalt();
    db.createUser(username, hashPassword(password, salt), salt, 'Administrador', 'superadmin');
    console.log(`\nAdmin creado: ${username} / ${password}  <- Cambielo desde el panel\n`);
  } else {
    const hasSuperadmin = users.some(u => u.role === 'superadmin');
    if (!hasSuperadmin) {
      const first = users[0];
      db.updateUser(first.id, first.name || first.username, 'superadmin');
      console.log(`\nUsuario "${first.username}" promovido a superadmin\n`);
    }
  }
}

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Credenciales requeridas' });
  const user = db.getUserByUsername(username.trim());
  if (!user || !user.active) return res.status(401).json({ error: 'Credenciales incorrectas' });
  const hash = hashPassword(password, user.salt);
  if (hash !== user.password_hash) return res.status(401).json({ error: 'Credenciales incorrectas' });
  const token = generateToken();
  db.createSession(token, user.id, user.username, user.name, user.role, user.clinic_id || 1, Date.now() + SESSION_TTL);
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
  db.createAuditLog(user.id, user.username, user.role, 'LOGIN', 'session', null, null, null, ip);
  const permissions = user.role === 'superadmin' ? ['*'] : db.getUserPermissions(user.role);
  return res.json({ token, name: user.name, role: user.role, permissions });
});

router.post('/logout', (req, res) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) db.deleteSession(token);
  return res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const permissions = req.user.role === 'superadmin' ? ['*'] : db.getUserPermissions(req.user.role);
  return res.json({ username: req.user.username, name: req.user.name, role: req.user.role, permissions });
});

// Expose helper for index.js
router.seedAdmin = seedAdmin;
router.hashPassword = hashPassword;
router.generateSalt = generateSalt;

module.exports = router;
