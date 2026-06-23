# Dental Bot — Telegram Bot para Clínicas Dentales

Bot de Telegram con IA (Google Gemini) para capturar leads, responder consultas y gestionar citas automáticamente. Incluye dashboard web con KPIs en tiempo real.

## Demo

```
Paciente → "Quiero una limpieza"
Bot      → "¡Hola! Encantado. Una limpieza dental cuesta 60€.
             ¿A qué nombre apunto la cita?"
Paciente → "Ana García, el martes por la mañana"
Bot      → "Perfecto, Ana. Cita registrada para el martes por la mañana.
             Recibirás confirmación en breve."
```

El admin recibe notificación en Telegram y puede confirmar con `/confirmar <ID>`.

## Funcionalidades

- Conversación guiada por estados (nombre → servicio → horario)
- Detecta 6 servicios dentales con precios configurables
- Valida horarios de atención (lun-vie 9-20h, sáb 9-14h)
- Motor de IA con Gemini (fallback local sin API)
- Dashboard web: KPIs, tabla de leads, gráfico de servicios
- Comandos admin: `/leads`, `/confirmar <ID>`
- Docker Ready

## Stack

| Paquete | Uso |
|---|---|
| `node-telegram-bot-api` | Conexión con Telegram vía polling |
| `@google/generative-ai` | Respuestas con IA (Gemini, gratis) |
| `better-sqlite3` | Base de datos SQLite local |
| `express` | Dashboard web + API REST |
| `dotenv` | Variables de entorno |

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/dental-bot.git
cd dental-bot

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Edita .env con tu TELEGRAM_TOKEN (obténlo en https://t.me/BotFather)
# y opcionalmente tu GEMINI_API_KEY (https://aistudio.google.com/apikey)

# 4. Arrancar
npm start
```

## Uso

Una vez arrancado:
- El bot responde en Telegram automáticamente
- Dashboard disponible en `http://localhost:3000`
- Los leads se guardan en `dental_bot.db` (se crea automáticamente)

## API REST

| Endpoint | Descripción |
|---|---|
| `GET /api/stats` | KPIs: total leads, confirmados, mensajes, top servicios |
| `GET /api/leads` | Todos los leads con estado |

## Estructura

```
dental-bot/
├── index.js           → Bot Telegram + servidor Express
├── db.js              → SQLite (esquema + CRUD)
├── ai.js              → Motor de conversación + Gemini
├── public/
│   └── index.html     → Dashboard web
├── Dockerfile
├── docker-compose.yml
├── .env.example       → Plantilla de configuración
└── package.json
```

## Personalización

Edita `ai.js` para adaptar el bot a otra clínica:
- `SERVICIOS` → catálogo de servicios y precios
- `SYSTEM_PROMPT` → nombre de la clínica y personalidad del bot
- `FLOWS` → respuestas predefinidas del fallback

## Docker

```bash
docker compose up -d
```

Accede al dashboard en `http://localhost:3000`.
