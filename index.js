require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express     = require('express');
const path        = require('path');

const db                             = require('./db');
const { getReplyWithPhone, extractCita } = require('./ai');
const { requireAuth, requirePerm }   = require('./middleware/auth');
const { botRateLimit, apiRateLimit } = require('./middleware/rateLimit');
const log                            = require('./services/logger');

// ── ROUTES ────────────────────────────────────────────────────────────────────
const authRouter         = require('./routes/auth');
const leadsRouter        = require('./routes/leads');
const profRouter         = require('./routes/professionals');
const schedulesRouter    = require('./routes/schedules');
const bookingsRouter     = require('./routes/bookings');
const usersRouter        = require('./routes/users');
const auditRouter        = require('./routes/audit');
const rbacRouter         = require('./routes/rbac');

const PORT           = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const NOTIFY_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ADMIN_IDS      = process.env.TELEGRAM_ADMIN_IDS
  ? process.env.TELEGRAM_ADMIN_IDS.split(',').map(id => id.trim()).filter(Boolean)
  : [];

if (!TELEGRAM_TOKEN) {
  console.error('Error: Debes configurar TELEGRAM_TOKEN en .env antes de iniciar el bot.');
  process.exit(1);
}

// ── TELEGRAM BOT ──────────────────────────────────────────────────────────────

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

bot.on('polling_error', (err) => log.error('Telegram polling error', { err: err.message }));

bot.on('message', async (msg) => {
  if (msg.chat.type !== 'private') return;

  const chatId        = String(msg.chat.id);
  const phone         = `tg:${chatId}`;
  const text          = msg.text ? msg.text.trim() : '';
  const contactNumber = msg.contact && msg.contact.user_id === msg.from.id
    ? msg.contact.phone_number : null;
  const isAdmin = ADMIN_IDS.includes(chatId);

  if (!isAdmin && botRateLimit(chatId)) {
    return bot.sendMessage(chatId, 'Por favor, espere un momento antes de enviar otro mensaje.');
  }

  // ── Admin commands ─────────────────────────────────────────────────────────
  if (text && /^\/(confirmar|confirm)\b/i.test(text)) {
    if (!isAdmin) return bot.sendMessage(chatId, 'Acceso restringido.');
    const match = text.match(/^\/(?:confirmar|confirm)\s+(\d+)/i);
    if (!match) return bot.sendMessage(chatId, 'Uso: /confirmar <ID>');
    const leadId = Number(match[1]);
    const lead   = db.getLeadById(leadId);
    if (!lead) return bot.sendMessage(chatId, `No se encontró la solicitud #${leadId}.`);
    db.confirmLead(leadId);
    await bot.sendMessage(chatId, `Cita ${lead.cita || `#${leadId}`} confirmada.\n\nPaciente: ${lead.name}\nEspecialidad: ${lead.service}\nHorario: ${lead.horario}`);
    if (lead.phone && lead.phone.startsWith('tg:')) {
      await bot.sendMessage(lead.phone.slice(3),
        `*Su cita en el Centro Médico ha sido confirmada.*\n\n` +
        `Especialidad: ${lead.service}\nHorario: ${lead.horario}\n\n` +
        `Dirección: XXXXX\n\n` +
        `Código: *${lead.cita}*\nTel: 111111111 · info@XXXXX.com`,
        { parse_mode: 'Markdown' }
      );
    }
    return;
  }

  if (text && /^\/leads\b/i.test(text)) {
    if (!isAdmin) return bot.sendMessage(chatId, 'Acceso restringido.');
    const pending = db.getPendingLeads();
    if (!pending.length) return bot.sendMessage(chatId, 'No hay solicitudes pendientes.');
    const lines = pending.map(l =>
      `${l.cita || `#${l.id}`} — ${l.name} | ${l.service} | ${l.horario || '—'} | ${l.contact || '—'}\n/confirmar ${l.id}`
    );
    return bot.sendMessage(chatId,
      `*Pendientes (${pending.length}):*\n\n${lines.join('\n\n')}`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!text && !contactNumber) return;

  if (text) {
    db.saveMessage(phone, 'user', text);
    log.info('bot_message', { chatId });
  } else {
    db.saveMessage(phone, 'user', `CONTACTO: ${contactNumber}`);
    log.info('bot_contact', { chatId });
  }

  try {
    const response  = getReplyWithPhone(phone, text, { contactNumber });
    const cleanText = response.text;

    await bot.sendMessage(chatId, cleanText, { parse_mode: 'Markdown' });
    db.saveMessage(phone, 'assistant', cleanText);

    const cita = extractCita(response);
    if (cita) {
      const notifyTargets = new Set([...(ADMIN_IDS || []), NOTIFY_CHAT_ID || '']);
      notifyTargets.delete(chatId);

      if (cita.existingId) {
        db.updateLeadDetails(cita.existingId, cita.name, cita.service, cita.horario, cita.contact, cita.mutua, cita.fecha_cita);
        if (cita.dni) db.updateLeadDni(cita.existingId, cita.dni);
        const saved = db.getLeadById(cita.existingId);
        for (const target of notifyTargets) {
          if (!target) continue;
          await bot.sendMessage(target,
            `*Cita modificada — ${saved.cita}*\n\nPaciente: ${saved.name}\nEspecialidad: ${saved.service}\nHorario: ${saved.horario}\nTel: ${saved.contact || '—'}\nMutua: ${saved.mutua || '—'}`,
            { parse_mode: 'Markdown' }
          );
        }
        await bot.sendMessage(chatId,
          `*Su cita ha sido modificada.*\n\nEspecialidad: ${saved.service}\nHorario: ${saved.horario}\nCódigo: ${saved.cita}\n\nNuestro equipo confirmará el nuevo horario en breve.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        const leadId = db.saveLead(phone, cita.name, cita.service, cita.horario, cita.contact, cita.mutua, cita.fecha_cita);
        if (cita.dni) db.updateLeadDni(leadId, cita.dni);
        const saved = db.getLeadById(leadId);
        log.info('lead_created', { leadId });

        await bot.sendMessage(chatId,
          `*Su solicitud de cita ha sido registrada.*\n\nCódigo: *${saved.cita}*\n\nGuarde este código para consultar o modificar su cita.\n\nNuestro equipo del *Centro Médico* confirmará el horario en breve.\n\nTel: 111111111 · info@XXXXX.com`,
          { parse_mode: 'Markdown' }
        );

        for (const target of notifyTargets) {
          if (!target) continue;
          await bot.sendMessage(target,
            `*Nueva solicitud — ${saved.cita}*\n\nPaciente: ${cita.name}\nEspecialidad: ${cita.service}\nHorario: ${cita.horario}\nTel: ${cita.contact || '—'}\nMutua: ${cita.mutua || '—'}${cita.dni ? '\nDNI/NIE: ' + cita.dni : ''}\n\n/confirmar ${leadId}`,
            { parse_mode: 'Markdown' }
          );
        }
      }
    }
  } catch (err) {
    log.error('bot_handler_error', { err: err.message, stack: err.stack });
    await bot.sendMessage(chatId, 'Lo sentimos, se ha producido un error. Por favor, inténtelo de nuevo.');
  }
});

// ── EXPRESS ───────────────────────────────────────────────────────────────────

const app = express();
app.use((_, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json());
app.use('/api', apiRateLimit);
app.use(express.static(path.join(__dirname, 'public')));

// Public routes
app.use('/api/auth',           authRouter);
app.post('/api/patient/lookup', (req, res, next) => {
  req.url = '/patient/lookup';
  leadsRouter(req, res, next);
});

// Versioned API — all protected routes
app.use('/api/v1/auth',        authRouter);
app.use('/api/v1/leads',       leadsRouter);
app.use('/api/v1/professionals', profRouter);
app.use('/api/v1/schedules',   schedulesRouter);
app.use('/api/v1/bookings',    bookingsRouter);
app.use('/api/v1/users',       usersRouter);
app.use('/api/v1/audit-logs',  auditRouter);
app.use('/api/v1/rbac',        rbacRouter);

// Legacy /api/* aliases for dashboard backward compat
app.use('/api/leads',          leadsRouter);
app.get('/api/stats',          requireAuth, requirePerm('citas.ver'), (_req, res) => res.json(db.getStats()));
app.use('/api/professionals',  profRouter);
app.use('/api/schedules',      schedulesRouter);
app.use('/api/bookings',       bookingsRouter);
app.use('/api/users',          usersRouter);
app.use('/api/audit-logs',     auditRouter);
app.use('/api/rbac',           rbacRouter);
app.get('/api/slots/:professionalId/:date', requireAuth, (req, res) => {
  const slots = db.getAvailableSlots(Number(req.params.professionalId), req.params.date);
  return res.json(slots);
});

// ── BOT CONTROLS ─────────────────────────────────────────────────────────────

app.get('/api/bot/status', requireAuth, (_req, res) => {
  res.json({ polling: bot.isPolling() });
});

app.post('/api/bot/stop', requireAuth, async (_req, res) => {
  try { await bot.stopPolling(); res.json({ ok: true, polling: false }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/bot/start', requireAuth, async (_req, res) => {
  try {
    if (!bot.isPolling()) await bot.startPolling();
    res.json({ ok: true, polling: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/bot/restart', requireAuth, async (_req, res) => {
  try {
    if (bot.isPolling()) await bot.stopPolling();
    await bot.startPolling();
    res.json({ ok: true, polling: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── SERVER ────────────────────────────────────────────────────────────────────

authRouter.seedAdmin();

const server = app.listen(PORT, () => {
  log.info('server_start', { port: PORT });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Error: Puerto ${PORT} en uso.`);
    process.exit(1);
  }
  throw err;
});

process.on('uncaughtException',  (err)    => log.error('uncaughtException', { err: err.message, stack: err.stack }));
process.on('unhandledRejection', (reason) => log.error('unhandledRejection', { err: String(reason) }));
