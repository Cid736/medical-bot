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

## Seguridad

Las revisiones de seguridad automatizadas utilizan [Claude](https://claude.ai) (Anthropic AI) y se ejecutan en cada cambio significativo para detectar vulnerabilidades, patrones inseguros y riesgos en dependencias. Los hallazgos se registran en [`BUGLOG.md`](BUGLOG.md).

**Última revisión:** 2026-06-25 (rev 4) — 12 vulnerabilidades totales parcheadas (1 crítica⚠️ acción manual requerida, 4 altas, 4 medias, 3 bajas). Revisión 4: allowlist en PUT /users/:id, validación HH:MM en horarios, allowlist de duraciones, validación YYYY-MM-DD en /api/slots, log de errores en audit.js, .dockerignore actualizado. Rotar token de Telegram manualmente.

¿Encontraste una vulnerabilidad? Abre un issue o contacta directamente.
## Licencia

MIT
