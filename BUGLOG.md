# Bug Log — dental-bot

## 2026-06-25 — Revisión 1

### [MEDIUM] Sin rate limiting en endpoint público de lookup de pacientes
- **Fix:** Añadido `apiRateLimit` en `POST /patient/lookup`.

### [LOW] Errores de migración silenciados completamente
- **Fix:** Solo se suprime `duplicate column name`; el resto se propaga.

### [CRITICAL — Acción manual requerida] Credenciales en `.env`
- Token de Telegram y contraseña de admin commiteados.
- **Acción:** Revocar token en @BotFather. Cambiar contraseña de admin.

---

## 2026-06-25 — Revisión 2

### [MEDIUM] IDOR latente: campo `userId` vs `id` en middleware de auth
- **Archivo:** `middleware/auth.js`, `routes/users.js`
- **Riesgo:** Si `auth.js` se refactoriza para usar `req.user.id`, el check de `users.js` (que usa `req.user.userId`) fallaría silenciosamente permitiendo a cualquier usuario cambiar contraseñas ajenas.
- **Fix:** Normalizado el campo a `userId` de forma explícita y documentado con comentario para futuros refactors.

### [LOW] Error lógico: nombre de paciente guardado como profesional en bookings
- **Archivo:** `routes/bookings.js`
- **Fix:** Reemplazado `db.updateLeadProfessional(lead_id, patient_name)` por `db.updateLeadProfessionalId(lead_id, professional_id)`.
