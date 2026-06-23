const fs   = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function getLogFile() {
  const d = new Date();
  const name = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}.log`;
  return path.join(LOG_DIR, name);
}

function write(level, msg, meta = {}) {
  // Strip PII fields from meta before logging
  const safe = Object.fromEntries(
    Object.entries(meta).filter(([k]) => !['phone','dni','name','contact','password','token','salt'].includes(k))
  );
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...safe }) + '\n';
  try { fs.appendFileSync(getLogFile(), line); } catch(_) {}
  // Also write to stdout (without PII)
  console.log(`[${level.toUpperCase()}] ${msg}`, Object.keys(safe).length ? safe : '');
}

module.exports = {
  info:  (msg, meta) => write('info',  msg, meta),
  warn:  (msg, meta) => write('warn',  msg, meta),
  error: (msg, meta) => write('error', msg, meta),
};
