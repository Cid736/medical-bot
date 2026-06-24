const express = require('express');
const db      = require('../db');
const { requireAuth, requirePerm } = require('../middleware/auth');
const { audit } = require('../services/audit');

const router = express.Router();

// Helper: checks if the requesting user has all listed perms (superadmin always passes)
function hasPerm(req, permKey) {
  if (req.user?.role === 'superadmin') return true;
  const userPerms = new Set(db.getUserPermissions(req.user?.role || ''));
  return userPerms.has(permKey);
}

router.get('/stats', requireAuth, requirePerm('citas.ver'), (_req, res) => res.json(db.getStats()));

router.get('/', requireAuth, requirePerm('citas.ver'), (req, res) => {
  const { q, estado, from, to, mutua, service } = req.query;
  if (q || estado || from || to || mutua || service) {
    let leads = db.getLeads();
    if (estado)  leads = leads.filter(l => l.estado === estado);
    if (from)    leads = leads.filter(l => l.fecha_cita && l.fecha_cita.slice(0,10) >= from);
    if (to)      leads = leads.filter(l => l.fecha_cita && l.fecha_cita.slice(0,10) <= to);
    if (mutua)   leads = leads.filter(l => (l.mutua||'').toLowerCase().includes(mutua.toLowerCase()));
    if (service) leads = leads.filter(l => (l.service||'').toLowerCase().includes(service.toLowerCase()));
    if (q) {
      const ql = q.toLowerCase();
      leads = leads.filter(l =>
        (l.name||'').toLowerCase().includes(ql) ||
        (l.cita||'').toLowerCase().includes(ql) ||
        (l.contact||'').includes(ql) ||
        (l.professional||'').toLowerCase().includes(ql)
      );
    }
    return res.json(leads);
  }
  return res.json(db.getLeads());
});

router.get('/export', requireAuth, requirePerm('citas.exportar'), (req, res) => {
  const { from, to, estado, mutua, service } = req.query;
  const leads = db.getLeadsFiltered({ from, to, estado, mutua, service });
  audit(req, 'EXPORT_CSV', 'leads', null, null, { from, to, estado, count: leads.length });
  const COLS = ['id','cita','name','service','horario','fecha_cita','estado','mutua','contact','professional','notes','created_at'];
  const escape = v => v == null ? '' : '"' + String(v).replace(/"/g, '""') + '"';
  const csv = [COLS.join(','), ...leads.map(l => COLS.map(c => escape(l[c])).join(','))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="citas-${Date.now()}.csv"`);
  return res.send('﻿' + csv); // BOM for Excel
});

router.get('/:id', requireAuth, requirePerm('citas.ver'), (req, res) => {
  const id = req.params.id;
  if (/^CITA-/i.test(id)) {
    const lead = db.getLeadByCita(id.toUpperCase());
    return lead ? res.json(lead) : res.status(404).json({ error: 'No encontrado' });
  }
  const num = Number(id);
  if (Number.isNaN(num)) return res.status(400).json({ error: 'ID inválido' });
  const lead = db.getLeadById(num);
  return lead ? res.json(lead) : res.status(404).json({ error: 'No encontrado' });
});

router.patch('/:id/notes', requireAuth, requirePerm('citas.notas'), (req, res) => {
  const id = Number(req.params.id);
  const { notes } = req.body || {};
  if (typeof notes !== 'string') return res.status(400).json({ error: 'Notas inválidas' });
  const old = db.getLeadById(id);
  db.updateLeadNotes(id, notes.trim());
  audit(req, 'UPDATE_NOTES', 'lead', id, { notes: old?.notes }, { notes: notes.trim() });
  return res.json({ ok: true });
});

router.patch('/:id/estado', requireAuth, requirePerm('citas.confirmar'), (req, res) => {
  const id = Number(req.params.id);
  const { estado } = req.body || {};
  const validos = ['pendiente', 'confirmado', 'rechazado', 'contactado'];
  if (!validos.includes(estado)) return res.status(400).json({ error: 'Estado no válido' });

  if (estado === 'confirmado' && !hasPerm(req, 'citas.confirmar'))
    return res.status(403).json({ error: 'Sin permisos para confirmar citas', required: 'citas.confirmar' });
  if (estado === 'rechazado' && !hasPerm(req, 'citas.cancelar'))
    return res.status(403).json({ error: 'Sin permisos para cancelar citas', required: 'citas.cancelar' });
  if (estado === 'contactado' && !hasPerm(req, 'citas.confirmar'))
    return res.status(403).json({ error: 'Sin permisos', required: 'citas.confirmar' });

  const old = db.getLeadById(id);
  db.updateLeadEstado(id, estado);
  audit(req, 'UPDATE_ESTADO', 'lead', id, { estado: old?.estado }, { estado });
  return res.json({ ok: true });
});

router.patch('/:id/professional', requireAuth, requirePerm('citas.confirmar'), (req, res) => {
  const id = Number(req.params.id);
  const { professional } = req.body || {};
  if (typeof professional !== 'string') return res.status(400).json({ error: 'Inválido' });
  const old = db.getLeadById(id);
  db.updateLeadProfessional(id, professional.trim() || null);
  audit(req, 'ASSIGN_PROFESSIONAL', 'lead', id, { professional: old?.professional }, { professional: professional.trim() || null });
  return res.json({ ok: true });
});

router.delete('/:id', requireAuth, requirePerm('citas.eliminar'), (req, res) => {
  const id = Number(req.params.id);
  const old = db.getLeadById(id);
  db.deleteLead(id);
  audit(req, 'DELETE', 'lead', id, old, null);
  return res.json({ ok: true });
});

router.post('/:id/anonymize', requireAuth, requirePerm('citas.eliminar'), (req, res) => {
  const id = Number(req.params.id);
  const old = db.getLeadById(id);
  if (!old) return res.status(404).json({ error: 'No encontrado' });
  db.anonymizeLead(id);
  audit(req, 'ANONYMIZE', 'lead', id, { name: old.name }, { name: '[ANONIMIZADO]' });
  return res.json({ ok: true });
});

// Patient lookup — public (no auth required)
router.post('/patient/lookup', (req, res) => {
  const { cita, dni } = req.body || {};
  if (!cita || !dni) return res.status(400).json({ error: 'Código de cita y DNI requeridos' });
  const lead = db.getLeadByCita(cita.trim().toUpperCase());
  if (!lead) return res.status(404).json({ error: 'Cita no encontrada' });
  if (!lead.dni || lead.dni.toUpperCase() !== dni.trim().toUpperCase())
    return res.status(403).json({ error: 'DNI o NIE no coincide con la cita' });
  return res.json({
    id: lead.id, cita: lead.cita, name: lead.name,
    service: lead.service, horario: lead.horario,
    mutua: lead.mutua, estado: lead.estado, fecha_cita: lead.fecha_cita,
    professional: lead.professional
  });
});

module.exports = router;
