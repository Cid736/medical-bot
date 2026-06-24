# Medical Bot — Bot de Telegram para Clínicas Médicas

Bot de Telegram con IA (Google Gemini) para capturar leads, responder consultas y gestionar citas automáticamente. Incluye dashboard web con KPIs en tiempo real. Adaptable a cualquier clínica médica o de salud.

## Demo

```
Paciente -> "Quiero una revisión general"
Bot      -> "Hola! Encantado. Una revisión general cuesta 60 EUR.
             ¿A qué nombre apunto la cita?"
Paciente -> "Ana García, el martes por la mañana"
Bot      -> "Perfecto, Ana. Cita registrada para el martes por la mañana.
             Recibirás confirmación en breve."
```

El admin recibe notificación en Telegram y puede confirmar con `/confirmar <ID>`.

## Funcionalidades

- Conversación guiada por estados (nombre -> servicio -> horario)
- Detecta servicios con precios configurables
- Valida horarios de atención (lun-vie 9-20h, sab 9-14h)
- Motor de IA con Gemini (fallback local sin API)
- Dashboard web: KPIs, tabla de leads, gráfico de servicios
- **Controles del bot** en el header del dashboard: Start / Stop / Restart del polling de Telegram sin reiniciar el servidor
- Comandos admin: `/leads`, `/confirmar <ID>`
- Docker Ready

## Stack

| Paquete | Uso |
|---|---|
| `node-telegram-bot-api` | Conexión con Telegram via polling |
| `@google/generative-ai` | Respuestas con IA (Gemini, gratis) |
| `better-sqlite3` | Base de datos SQLite local |
| `express` | Dashboard web + API REST |
| `dotenv` | Variables de entorno |

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/Cid736/medical-bot.git
cd medical-bot

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
- El bot responde en Telegram automáticamente
- Dashboard disponible en `http://localhost:3000`
- Los leads se guardan en `medical_bot.db` (se crea automáticamente)

## API REST

| Endpoint | Descripción |
|---|---|
| `GET /api/stats` | KPIs: total leads, confirmados, mensajes, top servicios |
| `GET /api/leads` | Todos los leads con estado |

## Estructura

```
medical-bot/
├── index.js           -> Bot Telegram + servidor Express
├── db.js              -> SQLite (esquema + CRUD)
├── ai.js              -> Motor de conversación + Gemini
├── public/
│   └── index.html     -> Dashboard web
├── Dockerfile
├── docker-compose.yml
├── .env.example       -> Plantilla de configuración
└── package.json
```

## Personalización

Edita `ai.js` para adaptar el bot a cualquier clínica:
- `SERVICIOS` -> catálogo de servicios y precios
- `SYSTEM_PROMPT` -> nombre de la clínica y personalidad del bot
- `FLOWS` -> respuestas predefinidas del fallback

## Docker

```bash
docker compose up -d
```

Accede al dashboard en `http://localhost:3000`.

## Historial de versiones

**v0.2.1** — 2026-06-24
- Fix: los endpoints Start/Restart del bot comprueban `isPolling()` para evitar error 500 al hacer doble Start
- Fix: el filtro `professional_id` se ignoraba silenciosamente en la exportación de leads — corregido

**v0.2.0** — 2026-06-23
- Novedades: controles del bot en la cabecera del dashboard (Iniciar / Parar / Reiniciar sin reiniciar el servidor)
- Novedades: banner de versión alfa
- Novedades: consentimiento RGPD, cifrado de datos, registro de auditoría, roles y permisos RBAC
- Refactor: renombrado de dental-bot a medical-bot

**v0.1.0** — 2026-05-01
- Publicación inicial: bot de Telegram, captura de leads, SQLite, dashboard web
