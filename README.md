# Medical Bot — Telegram Bot for Medical Clinics

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
# 1. Clone the repository
git clone https://github.com/Cid736/medical-bot.git
cd medical-bot

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your TELEGRAM_TOKEN (get it from https://t.me/BotFather)
# and optionally your GEMINI_API_KEY (https://aistudio.google.com/apikey)

# 4. Start
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
```

Access the dashboard at `http://localhost:3000`.

## Changelog

**v0.2.1** — 2026-06-24
- Fix: bot Start/Restart endpoints now guard with `isPolling()` to prevent error 500 on double-start
- Fix: `professional_id` filter was silently ignored in lead export — now applied correctly

**v0.2.0** — 2026-06-23
- Feat: bot controls in dashboard header (Start / Stop / Restart without server restart)
- Feat: alpha version banner
- Feat: RGPD consent gate, data encryption, audit log, RBAC roles and permissions
- Refactor: renamed from dental-bot to medical-bot

**v0.1.0** — 2026-05-01
- Initial release: Telegram bot, lead capture, SQLite, web dashboard
