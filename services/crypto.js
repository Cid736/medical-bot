const crypto = require('crypto');

const KEY_HEX = process.env.ENCRYPTION_KEY || '';
const ALGO    = 'aes-256-gcm';

if (KEY_HEX.length !== 64) {
  console.error('[FATAL] ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

const ENABLED = true;

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
