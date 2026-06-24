const express = require('express');
const db      = require('../db');
const { requireAuth, requirePerm } = require('../middleware/auth');
const { audit } = require('../services/audit');

const router = express.Router();

router.get('/:professionalId', requireAuth, requirePerm('agenda.ver'), (req, res) => {
  const { start, end } = req.query;
  if (start && end) {
    return res.json(db.getBookingsByProfessionalRange(Number(req.params.professionalId), start, end));
  }
  const today = new Date().toISOString().slice(0, 10);
  return res.json(db.getBookingsByProfessionalAndDate(Number(req.params.professionalId), today));
});

router.get('/slots/:professionalId/:date', requireAuth, requirePerm('agenda.ver'), (req, res) => {
  const slots = db.getAvailableSlots(Number(req.params.professionalId), req.params.date);
  return res.json(slots);
});

router.post('/', requireAuth, requirePerm('agenda.reservar'), (req, res) => {
  const { professional_id, date_slot, time_slot, lead_id, patient_name, service } = req.body || {};
  if (!professional_id || !date_slot || !time_slot)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  // Prevent same professional from having overlapping slots
  if (db.isSlotBooked(Number(professional_id), date_slot, time_slot))
    return res.status(409).json({ error: 'Ese horario ya está ocupado', code: 'SLOT_TAKEN' });

  // Prevent same patient from having two bookings at the same time (different doctors)
  if (lead_id && db.isPatientBooked(Number(lead_id), date_slot, time_slot))
    return res.status(409).json({ error: 'El paciente ya tiene una cita en ese horario', code: 'PATIENT_DOUBLE_BOOKED' });

  const result = db.createBooking(Number(professional_id), date_slot, time_slot, lead_id || null, patient_name || null, service || null);
  if (result.changes === 0)
    return res.status(409).json({ error: 'Horario no disponible', code: 'SLOT_TAKEN' });

  if (lead_id) db.updateLeadProfessional(Number(lead_id), patient_name || null);
  audit(req, 'CREATE', 'booking', result.lastInsertRowid, null, { professional_id, date_slot, time_slot, patient_name, service });
  return res.status(201).json({ id: result.lastInsertRowid });
});

router.patch('/:id/estado', requireAuth, requirePerm('agenda.reservar'), (req, res) => {
  const id = Number(req.params.id);
  if (!db.getBookingById(id)) return res.status(404).json({ error: 'Cita no encontrada' });
  const { estado } = req.body || {};
  const validos = ['pendiente', 'confirmado', 'cancelado'];
  if (!validos.includes(estado)) return res.status(400).json({ error: 'Estado no válido' });
  db.updateBookingEstado(id, estado);
  audit(req, 'UPDATE_ESTADO', 'booking', id, null, { estado });
  return res.json({ ok: true });
});

router.delete('/:id', requireAuth, requirePerm('agenda.reservar'), (req, res) => {
  const id = Number(req.params.id);
  if (!db.getBookingById(id)) return res.status(404).json({ error: 'Cita no encontrada' });
  db.deleteBooking(id);
  audit(req, 'DELETE', 'booking', id, null, null);
  return res.json({ ok: true });
});

module.exports = router;
