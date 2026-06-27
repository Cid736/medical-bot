// In-process sliding-window rate limiter — sufficient for single-instance deployment.
// Uses timestamps array per key to implement a true sliding window instead of a
// fixed-interval counter (which could be bypassed by bursting just before a reset).

const BOT_WINDOW  = 60 * 1000;  // 1 minute
const BOT_MAX     = 30;          // max messages per window per Telegram chatId
const API_WINDOW  = 60 * 1000;
const API_MAX     = 120;         // max API requests per window per IP

// Map: key → array of timestamps (ms)
const windows = new Map();

// Prune old entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of windows.entries()) {
    const maxWindow = key.startsWith('bot:') ? BOT_WINDOW : API_WINDOW;
    const fresh = times.filter(t => now - t < maxWindow);
    if (fresh.length === 0) windows.delete(key);
    else windows.set(key, fresh);
  }
}, 5 * 60 * 1000);

function _check(key, window, max) {
  const now  = Date.now();
  const times = (windows.get(key) || []).filter(t => now - t < window);
  times.push(now);
  windows.set(key, times);
  return times.length > max; // true → limit exceeded
}

function botRateLimit(chatId) {
  return _check(`bot:${chatId}`, BOT_WINDOW, BOT_MAX);
}

// SECURITY: Only trust x-forwarded-for when the app is behind a known reverse proxy.
// Set TRUST_PROXY=1 in .env when running behind nginx/Caddy/etc.
function _getClientIp(req) {
  if (process.env.TRUST_PROXY === '1') {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
      // Take the FIRST IP (client-supplied IPs are appended left-to-right by proxies)
      const first = xff.split(',')[0].trim();
      // Basic sanity check — accept only valid IP-looking strings to prevent header injection
      if (/^[\d.:a-fA-F]+$/.test(first)) return first;
    }
  }
  return req.socket?.remoteAddress || 'unknown';
}

function apiRateLimit(req, res, next) {
  const ip = _getClientIp(req);
  if (_check(`api:${ip}`, API_WINDOW, API_MAX))
    return res.status(429).json({ error: 'Demasiadas peticiones. Espere un momento.' });
  next();
}

module.exports = { botRateLimit, apiRateLimit };
