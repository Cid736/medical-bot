const db = require('../db');
const { SESSION_TTL } = require('../sessions');

// ─── PERMISSION CACHE ─────────────────────────────────────────────────────────
// Maps role name → Set of permission keys. TTL: 5 min.
const _permCache = new Map();
let _cacheStamp  = 0;
const CACHE_TTL  = 5 * 60 * 1000;

function _loadPerms(roleName) {
  if (Date.now() - _cacheStamp > CACHE_TTL) {
    _permCache.clear();
    _cacheStamp = Date.now();
  }
  if (_permCache.has(roleName)) return _permCache.get(roleName);

  const role = db.getRoleByName(roleName);
  const keys = role ? db.getRolePermissions(role.id).map(p => p.key) : [];
  const set  = new Set(keys);
  _permCache.set(roleName, set);
  return set;
}

function invalidatePermCache() {
  _permCache.clear();
  _cacheStamp = 0;
}

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  const session = db.getSession(token);
  if (!session) return res.status(401).json({ error: 'Sesión expirada o inválida' });
  // Extend session TTL on activity
  const newExpires = Date.now() + SESSION_TTL;
  db.extendSession(token, newExpires);
  req.user = { userId: session.user_id, username: session.username, name: session.name, role: session.role, clinicId: session.clinic_id };
  next();
}

function requirePerm(permKey) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado', code: 'UNAUTHORIZED' });
    if (req.user.role === 'superadmin') return next(); // superadmin bypasses all checks
    const perms = _loadPerms(req.user.role);
    if (!perms.has(permKey)) {
      return res.status(403).json({ error: 'Sin permisos para esta acción', required: permKey });
    }
    next();
  };
}

module.exports = { requireAuth, requirePerm, invalidatePermCache };
