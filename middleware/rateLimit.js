// In-process rate limiter — resets on restart, sufficient for single-instance deployment
const counts = new Map();
const BOT_WINDOW  = 60 * 1000;  // 1 minute
const BOT_MAX     = 30;          // max messages per minute per Telegram chatId
const API_WINDOW  = 60 * 1000;
const API_MAX     = 120;         // max API requests per minute per IP

setInterval(() => counts.clear(), 60 * 1000);

function botRateLimit(chatId) {
  const key = `bot:${chatId}`;
  const count = (counts.get(key) || 0) + 1;
  counts.set(key, count);
  return count > BOT_MAX;
}

function apiRateLimit(req, res, next) {
  const ip  = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const key = `api:${ip}`;
  const count = (counts.get(key) || 0) + 1;
  counts.set(key, count);
  if (count > API_MAX) return res.status(429).json({ error: 'Demasiadas peticiones. Espere un momento.' });
  next();
}

module.exports = { botRateLimit, apiRateLimit };
