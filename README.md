# Dental Bot — Telegram Bot for Dental Clinics

Telegram bot with AI (Google Gemini) to capture leads, answer queries and manage appointments automatically. Includes a web dashboard with real-time KPIs.

## Demo

```
Patient -> "I'd like a cleaning"
Bot     -> "Hello! A dental cleaning costs 60 EUR.
            What name should I put the appointment under?"
Patient -> "Ana Garcia, Tuesday morning"
Bot     -> "Perfect, Ana. Appointment registered for Tuesday morning.
            You'll receive confirmation shortly."
```

The admin gets a Telegram notification and can confirm with `/confirmar <ID>`.

## Features

- State-machine conversation flow (name -> service -> time slot)
- Detects 6 dental services with configurable prices
- Validates opening hours (Mon-Fri 9-20h, Sat 9-14h)
- AI engine with Gemini (local fallback without API)
- Web dashboard: KPIs, leads table, services chart
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
git clone https://github.com/Cid736/dental-bot.git
cd dental-bot

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
- Leads are saved to `dental_bot.db` (created automatically)

## REST API

| Endpoint | Description |
|---|---|
| `GET /api/stats` | KPIs: total leads, confirmed, messages, top services |
| `GET /api/leads` | All leads with status |

## Structure

```
dental-bot/
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

Edit `ai.js` to adapt the bot to another clinic:
- `SERVICIOS` -> service catalog and prices
- `SYSTEM_PROMPT` -> clinic name and bot personality
- `FLOWS` -> predefined fallback responses

## Docker

```bash
docker compose up -d
```

Access the dashboard at `http://localhost:3000`.
