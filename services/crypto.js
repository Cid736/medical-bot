const crypto = require('crypto');

const KEY_HEX = process.env.ENCRYPTION_KEY || '';
const ALGO    = 'aes-256-gcm';
const ENABLED = KEY_HEX.length === 64; // 32 bytes hex

if (!ENABLED) {
  console.warn('[crypto] ENCRYPTION_KEY not set or invalid — sensitive fields stored in plaintext. Set a 64-char hex key in .env to enable encryption.');
}

function encrypt(text) {
  if (!ENABLED || text == null) return text;
  const key = Buffer.from(KEY_HEX, 'hex');
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

function decrypt(stored) {
  if (!ENABLED || stored == null) return stored;
  if (!stored.includes(':')) return stored; // plaintext (pre-encryption data)
  try {
    const parts = stored.split(':');
    if (parts.length !== 3) return stored;
    const [ivHex, tagHex, encHex] = parts;
    const key = Buffer.from(KEY_HEX, 'hex');
    const iv  = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const enc = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch (_) { return stored; } // fallback: return as-is if decryption fails
}

module.exports = { encrypt, decrypt, ENABLED };
