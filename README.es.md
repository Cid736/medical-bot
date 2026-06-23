# Dental Bot — Bot de Telegram para Clinicas Dentales

Bot de Telegram con IA (Google Gemini) para capturar leads, responder consultas y gestionar citas automaticamente. Incluye dashboard web con KPIs en tiempo real.

## Demo

```
Paciente -> "Quiero una limpieza"
Bot      -> "Hola! Encantado. Una limpieza dental cuesta 60 EUR.
             ¿A que nombre apunto la cita?"
Paciente -> "Ana Garcia, el martes por la manana"
Bot      -> "Perfecto, Ana. Cita registrada para el martes por la manana.
             Recibiras confirmacion en breve."
```

El admin recibe notificacion en Telegram y puede confirmar con `/confirmar <ID>`.

## Funcionalidades

- Conversacion guiada por estados (nombre -> servicio -> horario)
- Detecta 6 servicios dentales con precios configurables
- Valida horarios de atencion (lun-vie 9-20h, sab 9-14h)
- Motor de IA con Gemini (fallback local sin API)
- Dashboard web: KPIs, tabla de leads, grafico de servicios
- Comandos admin: `/leads`, `/confirmar <ID>`
- Docker Ready

## Stack

| Paquete | Uso |
|---|---|
| `node-telegram-bot-api` | Conexion con Telegram via polling |
| `@google/generative-ai` | Respuestas con IA (Gemini, gratis) |
| `better-sqlite3` | Base de datos SQLite local |
| `express` | Dashboard web + API REST |
| `dotenv` | Variables de entorno |

## Instalacion

```bash
# 1. Clonar el repositorio
git clone https://github.com/Cid736/dental-bot.git
cd dental-bot

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Edita .env con tu TELEGRAM_TOKEN (obtenlo en https://t.me/BotFather)
# y opcionalmente tu GEMINI_API_KEY (https://aistudio.google.com/apikey)

# 4. Arrancar
npm start
```

## Uso

Una vez arrancado:
- El bot responde en Telegram automaticamente
- Dashboard disponible en `http://localhost:3000`
- Los leads se guardan en `dental_bot.db` (se crea automaticamente)

## API REST

| Endpoint | Descripcion |
|---|---|
| `GET /api/stats` | KPIs: total leads, confirmados, mensajes, top servicios |
| `GET /api/leads` | Todos los leads con estado |

## Estructura

```
dental-bot/
├── index.js           -> Bot Telegram + servidor Express
├── db.js              -> SQLite (esquema + CRUD)
├── ai.js              -> Motor de conversacion + Gemini
├── public/
│   └── index.html     -> Dashboard web
├── Dockerfile
├── docker-compose.yml
├── .env.example       -> Plantilla de configuracion
└── package.json
```

## Personalizacion

Edita `ai.js` para adaptar el bot a otra clinica:
- `SERVICIOS` -> catalogo de servicios y precios
- `SYSTEM_PROMPT` -> nombre de la clinica y personalidad del bot
- `FLOWS` -> respuestas predefinidas del fallback

## Docker

```bash
docker compose up -d
```

Accede al dashboard en `http://localhost:3000`.
