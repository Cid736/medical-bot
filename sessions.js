const db = require('./db');

const SESSION_TTL = 8 * 60 * 60 * 1000;

// Prune expired sessions every 30 minutes
setInterval(() => { try { db.pruneExpiredSessions(); } catch(_) {} }, 30 * 60 * 1000);

module.exports = { SESSION_TTL };
