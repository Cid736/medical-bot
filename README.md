<p align="center">
  <a href="#english">🇬🇧 English</a> &nbsp;·&nbsp; <a href="#español">🇪🇸 Español</a>
</p>

---

<a name="english"></a>

# Medical Bot

Telegram bot with AI (Google Gemini) to capture leads, answer queries and manage appointments automatically. Includes a web dashboard with real-time KPIs. Adaptable to any medical or healthcare clinic.

## Demo

```
Patient -> "I'd like a check-up"
Bot     -> "Hello! A general check-up costs 60 EUR.
            What name should I put the appointment under?"
Patient -> "Ana Garcia, Tuesday morning"
Bot     -> "Perfect, Ana. Appointment registered for Tuesday morning.
            You'll receive confirmation shortly."
```

The admin gets a Telegram notification and can confirm with `/confirmar <ID>`.

## Features

- State-machine conversation flow (name -> service -> time slot)
- Detects services with configurable prices
- Validates opening hours (Mon-Fri 9-20h, Sat 9-14h)
- AI engine with Gemini (local fallback without API)
- Web dashboard: KPIs, leads table, services chart
- **Bot controls** in the dashboard header: Start / Stop / Restart the Telegram polling without restarting the server
- Admin commands: `/leads`, `/confirmar <ID>`
- Docker ready

## Stack

| Package | Purpose |
|---|---|
| `node-telegram-bot-api` | Telegram connection via polling |
| `@google/generative-ai` | AI responses (Gemini, free) |
| `better-sqlite3` | Local SQLite database |
| `express` | Web dashboard + REST API |
| `dotenv` | Environment variables |

## Setup

```bash
git clone https://github.com/Cid736/medical-bot.git
cd medical-bot
npm install
cp .env.example .env
# Edit .env with your TELEGRAM_TOKEN (https://t.me/BotFather)
# and optionally your GEMINI_API_KEY (https://aistudio.google.com/apikey)
npm start
```

## Usage

Once running:
- The bot responds on Telegram automatically
- Dashboard available at `http://localhost:3000`
- Leads are saved to `medical_bot.db` (created automatically)

## REST API

| Endpoint | Description |
|---|---|
| `GET /api/stats` | KPIs: total leads, confirmed, messages, top services |
| `GET /api/leads` | All leads with status |

## Structure

```
medical-bot/
├── index.js           -> Telegram bot + Express server
├── db.js              -> SQLite (schema + CRUD)
├── ai.js              -> Conversation engine + Gemini
├── public/
│   └── index.html     -> Web dashboard
├── Dockerfile
├── docker-compose.yml
├── .env.example       -> Configuration template
└── package.json
```

## Customization

Edit `ai.js` to adapt the bot to any clinic:
- `SERVICIOS` -> service catalog and prices
- `SYSTEM_PROMPT` -> clinic name and bot personality
- `FLOWS` -> predefined fallback responses

## Docker

```bash
docker compose up -d
# Dashboard at http://localhost:3000
```

## Changelog

**v0.2.2** — 2026-06-24
- Security: hardcoded admin password removed from source — `ADMIN_PASSWORD` is now required in `.env`; server exits on startup if missing
- Security: `PATCH /:id/estado` and `PATCH /:id/professional` routes now require write permission (`citas.confirmar`)
- Security: PII fields (`dni`, `contact`, `notes`) masked for non-superadmin roles
- Security: IDOR fixed on `PATCH /bookings/:id/estado` and `DELETE /bookings/:id`
- Admin password no longer printed to console logs

**v0.2.1** — 2026-06-24
- Fix: bot Start/Restart endpoints now guard with `isPolling()` to prevent 500 on double-start
- Fix: `professional_id` filter was silently ignored in lead export — now applied correctly

**v0.2.0** — 2026-06-23
- Feat: bot controls in dashboard header (Start / Stop / Restart without server restart)
- Feat: RGPD consent gate, data encryption, audit log, RBAC roles and permissions
- Refactor: renamed from dental-bot to medical-bot

**v0.1.0** — 2026-05-01
- Initial release: Telegram bot, lead capture, SQLite, web dashboard

## License

MIT

## Security

Automated security reviews are powered by [Claude](https://claude.ai) (Anthropic AI) and run on every significant change to detect vulnerabilities, insecure patterns and dependency risks. Findings are tracked in [`BUGLOG.md`](BUGLOG.md).

**Last review:** 2026-06-25 — 4 issues found (1 critical⚠️ manual action required, 1 medium, 2 low) — code patched. Rotate Telegram token manually.

Found a vulnerability? Open an issue or contact directly.

---

<a name="español"></a>

# Medical Bot

Bot de Telegram con IA (Google Gemini) para capturar leads, responder consultas y gestionar citas automáticamente. Incluye un panel web con KPIs en tiempo real. Adaptable a cualquier clínica médica o sanitaria.

## Demo

```
Paciente -> "Quiero hacerme una revisión"
Bot      -> "¡Hola! Una revisión general cuesta 60 EUR.
             ¿A qué nombre pongo la cita?"
Paciente -> "Ana García, el martes por la mañana"
Bot      -> "Perfecto, Ana. Cita registrada para el martes por la mañana.
             Recibirás confirmación en breve."
```

El admin recibe una notificación en Telegram y puede confirmar con `/confirmar <ID>`.

## Características

- Flujo de conversación por máquina de estados (nombre -> servicio -> horario)
- Detección de servicios con precios configurables
- Validación de horarios de apertura (Lun-Vie 9-20h, Sáb 9-14h)
- Motor de IA con Gemini (fallback local sin API)
- Panel web: KPIs, tabla de leads, gráfico de servicios
- **Controles del bot** en la cabecera del panel: Iniciar / Detener / Reiniciar el polling sin reiniciar el servidor
- Comandos de admin: `/leads`, `/confirmar <ID>`
- Listo para Docker

## Stack

| Paquete | Función |
|---|---|
| `node-telegram-bot-api` | Conexión con Telegram via polling |
| `@google/generative-ai` | Respuestas con IA (Gemini, gratuito) |
| `better-sqlite3` | Base de datos SQLite local |
| `express` | Panel web + API REST |
| `dotenv` | Variables de entorno |

## Instalación

```bash
git clone https://github.com/Cid736/medical-bot.git
cd medical-bot
npm install
cp .env.example .env
# Edita .env con tu TELEGRAM_TOKEN (https://t.me/BotFather)
# y opcionalmente tu GEMINI_API_KEY (https://aistudio.google.com/apikey)
npm start
```

## Personalización

Edita `ai.js` para adaptar el bot a cualquier clínica:
- `SERVICIOS` -> catálogo de servicios y precios
- `SYSTEM_PROMPT` -> nombre de la clínica y personalidad del bot
- `FLOWS` -> respuestas de fallback predefinidas

## Docker

```bash
docker compose up -d
# Panel disponible en http://localhost:3000
```

## Security

Las revisiones de seguridad se realizan con [Claude Code](https://claude.ai) (Anthropic AI) en cada cambio significativo. Los hallazgos históricos se registran en [`BUGLOG.md`](BUGLOG.md).

**Última revisión:** 2026-06-28 (rev 6)

### Medidas implementadas

| Área | Mecanismo |
|---|---|
| Autenticación dashboard | PBKDF2-SHA512 · 210 000 iteraciones · salt de 16 bytes · migración automática de hashes legacy |
| Sesiones | Token de 32 bytes aleatorios (256 bits) · TTL 8 h · almacenadas en SQLite · borrado en logout |
| Cifrado de datos sensibles | AES-256-GCM · IV aleatorio por registro · tag de autenticación · obligatorio al arranque |
| Datos protegidos | DNI/NIE, teléfono y notas clínicas cifrados en reposo |
| Cabeceras HTTP | `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` |
| Rate limiting | Ventana deslizante (no fija) · 30 msg/min por chat Telegram · 120 req/min por IP en API |
| IP de cliente | `X-Forwarded-For` solo se confía con `TRUST_PROXY=1` (detrás de proxy conocido) |
| RGPD | Consentimiento explícito antes de recopilar datos · anonimización de registros · tabla `consents` |
| Auditoría | Log completo de todas las acciones CRUD con usuario, rol, IP y datos antes/después |
| Validación de input bot | Nombre, teléfono, DNI/NIE y mutua validados con regex y checksums antes de guardar |
| Lookup público de citas | Respuesta uniforme 404 para cita-no-encontrada Y DNI-incorrecto (evita enumeración) · comparación time-safe |
| Roles y permisos | RBAC dinámico con 20 permisos granulares · caché de permisos con TTL de 5 min |
| Contraseñas | Mínimo 10 caracteres exigido en panel y en `ADMIN_PASSWORD` de arranque |
| Dependencias | `node-telegram-bot-api` 1.1.2 (fix CVE SSRF+CRLF) · Express 4.22.x · better-sqlite3 9.6.x |
| SQLite | Todas las queries usan sentencias preparadas (no hay interpolación de strings en SQL) |
| Logger | PII filtrada antes de escribir en logs (sin teléfonos, DNI, nombres, tokens) |

### Acción manual pendiente (obligatoria en producción)

- **Rotar `TELEGRAM_TOKEN`** si alguna vez estuvo en el repositorio. Hacerlo desde BotFather con `/revoke`.
- Generar `ENCRYPTION_KEY` con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y guardarla en `.env`. **Nunca commitear esta clave.**
- Cambiar la contraseña del admin inicial desde el panel después del primer arranque.

### Hallazgos resueltos en revisión 6 (2026-06-28)

| Severidad | Hallazgo | Fix aplicado |
|---|---|---|
| ALTA | `getPendingLeads()` devolvía datos sin descifrar al bot Telegram | `db.js` · añadir `.map(decryptLead)` |
| ALTA | Sin `Content-Security-Policy` — XSS no mitigado en navegadores modernos | `index.js` · cabecera CSP completa |
| ALTA | Rate limiter con ventana fija (bypasseable con burst antes del reset) | `rateLimit.js` · reescrito con sliding window real |
| ALTA | PBKDF2 con 10 000 iteraciones (muy por debajo de NIST 2023) | `auth.js`, `users.js` · 210 000 iters + migración transparente de hashes legacy |
| ALTA | `X-Forwarded-For` confiado ciegamente (bypass rate limit vía header falso) | `rateLimit.js` · solo confiado con `TRUST_PROXY=1` |
| MEDIA | `date_slot` start/end no validados en GET bookings | `bookings.js` · validación regex YYYY-MM-DD |
| MEDIA | Lookup público de citas diferenciaba "cita no existe" (404) de "DNI incorrecto" (403) | `leads.js` · respuesta uniforme 404 + comparación `timingSafeEqual` |
| BAJA | `ENCRYPTION_KEY` ausente de `.env.example` | `.env.example` · añadida con instrucciones |
| BAJA | Contraseña mínima de 6 caracteres (insuficiente para datos médicos) | `users.js`, `auth.js` · mínimo 10 caracteres |
| BAJA | `setInterval(() => {}, 30000)` código muerto en dashboard HTML | `public/index.html` · eliminado |
| INFO | Mensaje seedAdmin citaba "dental-bot" (nombre de proyecto incorrecto) | `auth.js` · corregido a "medical-bot" |

¿Encontraste una vulnerabilidad? Abre un issue privado o contacta directamente.
## Licencia

MIT
