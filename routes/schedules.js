const express = require('express');
const db      = require('../db');
const { requireAuth, requirePerm } = require('../middleware/auth');
const { audit } = require('../services/audit');

const router = express.Router();

router.get('/:professionalId', requireAuth, requirePerm('horarios.ver'), (req, res) =>
  res.json(db.getSchedulesByProfessional(Number(req.params.professionalId)))
);

router.post('/', requireAuth, requirePerm('horarios.gestionar'), (req, res) => {
  const VALID_DURATIONS = [15, 20, 30, 60];
  const TIME_RE = /^\d{2}:\d{2}$/;
  const { professional_id, day_of_week, start_time, end_time, slot_duration } = req.body || {};
  if (!professional_id || !day_of_week || !start_time || !end_time)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  if (!TIME_RE.test(start_time) || !TIME_RE.test(end_time))
    return res.status(400).json({ error: 'Formato de hora inválido (HH:MM)' });
  const dur = Number(slot_duration) || 30;
  if (!VALID_DURATIONS.includes(dur))
    return res.status(400).json({ error: `Duración inválida. Válidas: ${VALID_DURATIONS.join(', ')} min` });
  db.setDaySchedule(Number(professional_id), Number(day_of_week), start_time, end_time, dur);
  audit(req, 'SET_SCHEDULE', 'schedule', `${professional_id}:${day_of_week}`, null, { start_time, end_time, slot_duration });
  return res.json({ ok: true });
});

router.delete('/:professionalId/:dayOfWeek', requireAuth, requirePerm('horarios.gestionar'), (req, res) => {
  const profId = Number(req.params.professionalId);
  const dow    = Number(req.params.dayOfWeek);
  db.deleteDaySchedule(profId, dow);
  audit(req, 'DELETE_SCHEDULE', 'schedule', `${profId}:${dow}`, null, null);
  return res.json({ ok: true });
});

module.exports = router;
