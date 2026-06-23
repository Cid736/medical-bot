const express = require('express');
const db      = require('../db');
const { requireAuth, requirePerm } = require('../middleware/auth');
const { audit } = require('../services/audit');

const router = express.Router();

router.get('/:professionalId', requireAuth, requirePerm('horarios.ver'), (req, res) =>
  res.json(db.getSchedulesByProfessional(Number(req.params.professionalId)))
);

router.post('/', requireAuth, requirePerm('horarios.gestionar'), (req, res) => {
  const { professional_id, day_of_week, start_time, end_time, slot_duration } = req.body || {};
  if (!professional_id || !day_of_week || !start_time || !end_time)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  db.setDaySchedule(Number(professional_id), Number(day_of_week), start_time, end_time, Number(slot_duration) || 30);
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
