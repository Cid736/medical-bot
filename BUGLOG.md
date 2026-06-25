# Bug Log — dental-bot

## 2026-06-25

### [MEDIUM] Sin rate limiting en endpoint público de lookup de pacientes
- **Archivo:** `routes/leads.js`
- **Fix:** Añadido middleware `apiRateLimit` al endpoint `POST /patient/lookup` para prevenir brute-force de combinaciones DNI/código de cita.

### [LOW] Errores de migración silenciados completamente
- **Archivo:** `db.js`
- **Fix:** El bloque `catch` ahora solo suprime el error `duplicate column name` (comportamiento esperado en migraciones idempotentes). Cualquier otro error de base de datos se propaga normalmente.

### [CRITICAL — Acción manual requerida] Credenciales en `.env`
- Token de Telegram y contraseña de admin commiteados en `.env`.
- **Acción:** Revocar el token en @BotFather. Cambiar la contraseña de admin. Añadir `.env` al `.gitignore`.
