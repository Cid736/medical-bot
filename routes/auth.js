const express  = require('express');
const crypto   = require('crypto');
const db       = require('../db');
const { SESSION_TTL } = require('../sessions');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const PBKDF2_ITERS = 210000; // NIST SP 800-132 (2023): ≥600k for SHA-512; 210k is a practical minimum
const PBKDF2_ITERS_LEGACY = 10000; // old value — only used for migration check

function hashPassword(password, salt, iters = PBKDF2_ITERS) {
  return crypto.pbkdf2Sync(password, salt, iters, 64, 'sha512').toString('hex');
}
function generateSalt()  { return crypto.randomBytes(16).toString('hex'); }
function generateToken() { return crypto.randomBytes(32).toString('hex'); }

// Seed admin on first run, or promote to superadmin if none exists
function seedAdmin() {
  const users = db.getAllUsers();
  if (!users.length) {
    if (!process.env.ADMIN_PASSWORD) {
      console.error('\n[medical-bot] FATAL: ADMIN_PASSWORD no está definido en .env — necesario para crear el admin inicial\n');
      process.exit(1);
    }
    if (process.env.ADMIN_PASSWORD.length < 10) {
      console.error('\n[medical-bot] FATAL: ADMIN_PASSWORD debe tener al menos 10 caracteres\n');
      process.exit(1);
    }
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD;
    const salt     = generateSalt();
    db.createUser(username, hashPassword(password, salt), salt, 'Administrador', 'superadmin');
    console.log(`\nAdmin creado: ${username}  <- Cambielo desde el panel\n`);
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

  // Check new iteration count first; fall back to legacy count for existing accounts
  const hashNew    = hashPassword(password, user.salt, PBKDF2_ITERS);
  const hashLegacy = hashPassword(password, user.salt, PBKDF2_ITERS_LEGACY);
  const isNew    = hashNew    === user.password_hash;
  const isLegacy = hashLegacy === user.password_hash;
  if (!isNew && !isLegacy) return res.status(401).json({ error: 'Credenciales incorrectas' });

  // Transparently upgrade legacy hashes on successful login
  if (isLegacy) {
    const newSalt = generateSalt();
    db.updateUserPassword(user.id, hashPassword(password, newSalt, PBKDF2_ITERS), newSalt);
  }

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
