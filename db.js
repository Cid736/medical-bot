const Database = require('better-sqlite3');
const db = new Database('dental_bot.db');
const { encrypt, decrypt } = require('./services/crypto');

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    phone      TEXT NOT NULL,
    name       TEXT,
    service    TEXT,
    horario    TEXT,
    contact    TEXT,
    estado     TEXT DEFAULT 'pendiente',
    cita       TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    phone      TEXT NOT NULL,
    role       TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS professionals (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    specialty  TEXT,
    active     INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt          TEXT NOT NULL,
    name          TEXT,
    role          TEXT DEFAULT 'admin',
    active        INTEGER DEFAULT 1,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    professional_id INTEGER NOT NULL,
    day_of_week     INTEGER NOT NULL,
    start_time      TEXT NOT NULL DEFAULT '08:00',
    end_time        TEXT NOT NULL DEFAULT '20:30',
    slot_duration   INTEGER DEFAULT 30,
    active          INTEGER DEFAULT 1,
    UNIQUE(professional_id, day_of_week)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    professional_id  INTEGER NOT NULL,
    date_slot        TEXT NOT NULL,
    time_slot        TEXT NOT NULL,
    lead_id          INTEGER,
    patient_name     TEXT,
    service          TEXT,
    estado           TEXT DEFAULT 'pendiente',
    created_at       TEXT DEFAULT (datetime('now')),
    UNIQUE(professional_id, date_slot, time_slot)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER,
    username    TEXT NOT NULL,
    role        TEXT,
    action      TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   TEXT,
    old_data    TEXT,
    new_data    TEXT,
    ip          TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    username   TEXT NOT NULL,
    name       TEXT,
    role       TEXT NOT NULL,
    clinic_id  INTEGER DEFAULT 1,
    expires    INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS consents (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    phone      TEXT NOT NULL UNIQUE,
    channel    TEXT NOT NULL DEFAULT 'telegram',
    version    TEXT NOT NULL DEFAULT '1.0',
    accepted_at TEXT DEFAULT (datetime('now')),
    ip         TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS clinics (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    slug       TEXT UNIQUE,
    address    TEXT,
    phone      TEXT,
    email      TEXT,
    active     INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS roles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    is_system   INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS permissions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    key         TEXT NOT NULL UNIQUE,
    description TEXT,
    category    TEXT
  );

  CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  );
`);

const migrations = [
  'ALTER TABLE leads ADD COLUMN contact TEXT',
  'ALTER TABLE leads ADD COLUMN cita TEXT',
  'ALTER TABLE leads ADD COLUMN notes TEXT',
  'ALTER TABLE leads ADD COLUMN mutua TEXT',
  'ALTER TABLE leads ADD COLUMN fecha_cita TEXT',
  'ALTER TABLE leads ADD COLUMN professional TEXT',
  'ALTER TABLE leads ADD COLUMN dni TEXT',
  'ALTER TABLE users ADD COLUMN clinic_id INTEGER DEFAULT 1',
  'ALTER TABLE users ADD COLUMN role_id INTEGER',
  'ALTER TABLE leads ADD COLUMN clinic_id INTEGER DEFAULT 1',
  'ALTER TABLE leads ADD COLUMN professional_id INTEGER',
];

for (const sql of migrations) {
  try { db.prepare(sql).run(); } catch (_) {}
}

function migrateProfessionalIds() {
  const profs = db.prepare('SELECT id, name FROM professionals WHERE active = 1').all();
  if (!profs.length) return;
  const unmapped = db.prepare("SELECT id, professional FROM leads WHERE professional_id IS NULL AND professional IS NOT NULL AND professional != ''").all();
  if (!unmapped.length) return;
  let mapped = 0, orphans = 0;
  const stmt = db.prepare('UPDATE leads SET professional_id = ? WHERE id = ?');
  for (const lead of unmapped) {
    const prof = profs.find(p => p.name.trim().toLowerCase() === (lead.professional||'').trim().toLowerCase());
    if (prof) { stmt.run(prof.id, lead.id); mapped++; }
    else orphans++;
  }
  if (mapped || orphans)
    console.log(`[migración] professional_id: ${mapped} mapeados, ${orphans} huérfanos (professional no encontrado en tabla professionals)`);
}
migrateProfessionalIds();

// ─── SEED RBAC ───────────────────────────────────────────────────────────────

function seedRBAC() {
  const PERMISSIONS = [
    // category, key, description
    ['Citas', 'citas.ver',          'Consultar solicitudes de cita'],
    ['Citas', 'citas.confirmar',     'Confirmar citas'],
    ['Citas', 'citas.cancelar',      'Cancelar citas'],
    ['Citas', 'citas.eliminar',      'Eliminar registros de cita'],
    ['Citas', 'citas.notas',         'Editar notas clínicas'],
    ['Citas', 'citas.exportar',      'Exportar datos de pacientes CSV'],
    ['Agenda','agenda.ver',          'Consultar agenda de profesionales'],
    ['Agenda','agenda.reservar',     'Crear reservas en agenda'],
    ['Profesionales','profesionales.ver',       'Ver listado de profesionales'],
    ['Profesionales','profesionales.gestionar', 'Crear / editar / eliminar profesionales'],
    ['Horarios','horarios.ver',       'Ver horarios configurados'],
    ['Horarios','horarios.gestionar', 'Configurar horarios de profesionales'],
    ['Pacientes','pacientes.ver',     'Ver datos de pacientes'],
    ['Pacientes','pacientes.editar',  'Modificar datos sensibles del paciente'],
    ['Usuarios','usuarios.ver',       'Ver usuarios del sistema'],
    ['Usuarios','usuarios.gestionar', 'Crear / editar / eliminar usuarios'],
    ['Roles','roles.ver',             'Ver roles y permisos'],
    ['Roles','roles.gestionar',       'Crear / editar / eliminar roles'],
    ['Auditoría','auditoria.ver',     'Consultar registros de auditoría'],
    ['Sistema','sistema.clinicas',    'Gestionar centros médicos'],
  ];

  const ROLES = [
    { name: 'superadmin',    description: 'Acceso total al sistema',           is_system: 1 },
    { name: 'admin',         description: 'Administrador del centro médico',   is_system: 1 },
    { name: 'manager',       description: 'Manager / supervisor',              is_system: 1 },
    { name: 'administrativo',description: 'Personal administrativo / recepción',is_system: 1 },
    { name: 'enfermeria',    description: 'Personal de enfermería',            is_system: 1 },
    { name: 'doctor',        description: 'Médico / especialista',             is_system: 1 },
  ];

  // Permission matrix: role → list of permission keys it has
  const ROLE_PERMS = {
    superadmin:     null, // null = ALL
    admin:          ['citas.ver','citas.confirmar','citas.cancelar','citas.eliminar','citas.notas','citas.exportar','agenda.ver','agenda.reservar','profesionales.ver','profesionales.gestionar','horarios.ver','horarios.gestionar','pacientes.ver','pacientes.editar','usuarios.ver','usuarios.gestionar'],
    manager:        ['citas.ver','citas.confirmar','citas.cancelar','citas.notas','citas.exportar','agenda.ver','agenda.reservar','profesionales.ver','horarios.ver','horarios.gestionar','pacientes.ver','pacientes.editar'],
    administrativo: ['citas.ver','citas.confirmar','citas.cancelar','citas.notas','agenda.ver','agenda.reservar','profesionales.ver','horarios.ver','pacientes.ver','pacientes.editar'],
    enfermeria:     ['citas.ver','citas.notas','agenda.ver','profesionales.ver','horarios.ver','pacientes.ver'],
    doctor:         ['citas.ver','citas.notas','agenda.ver','profesionales.ver','horarios.ver','pacientes.ver'],
  };

  // Insert permissions if missing
  const insertPerm = db.prepare('INSERT OR IGNORE INTO permissions (category, key, description) VALUES (?,?,?)');
  for (const [cat, key, desc] of PERMISSIONS) insertPerm.run(cat, key, desc);

  // Insert roles if missing
  const insertRole = db.prepare('INSERT OR IGNORE INTO roles (name, description, is_system) VALUES (?,?,?)');
  for (const r of ROLES) insertRole.run(r.name, r.description, r.is_system);

  // Assign permissions to roles
  const allPerms = db.prepare('SELECT * FROM permissions').all();
  const permMap  = Object.fromEntries(allPerms.map(p => [p.key, p.id]));

  const insertRP = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?,?)');
  for (const [roleName, perms] of Object.entries(ROLE_PERMS)) {
    const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(roleName);
    if (!role) continue;
    const keys = perms === null ? allPerms.map(p => p.key) : perms;
    for (const key of keys) {
      if (permMap[key]) insertRP.run(role.id, permMap[key]);
    }
  }

  // Default clinic
  db.prepare('INSERT OR IGNORE INTO clinics (id, name, slug, address, phone, email) VALUES (1,?,?,?,?,?)')
    .run('Centre Mèdic Esplugues', 'cme', 'Mestre Joan Corrales, 67, Esplugues de Llobregat', '93 470 53 10', 'info@cmesplugues.com');
}

seedRBAC();

// Generador de ID legible para citas
function generarIdCita() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 10; attempt++) {
    let id = 'CITA-';
    for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
    const exists = db.prepare('SELECT 1 FROM leads WHERE cita = ?').get(id);
    if (!exists) return id;
  }
  return 'CITA-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function decryptLead(lead) {
  if (!lead) return lead;
  return {
    ...lead,
    contact: decrypt(lead.contact),
    dni:     decrypt(lead.dni),
    notes:   decrypt(lead.notes)
  };
}

module.exports = {
  saveLead(phone, name, service, horario = null, contact = null, mutua = null, fecha_cita = null) {
    const existing = db.prepare('SELECT id, cita FROM leads WHERE phone = ?').get(phone);
    if (existing) {
      db.prepare('UPDATE leads SET name=?, service=?, horario=?, contact=?, estado=?, mutua=?, fecha_cita=? WHERE phone=?')
        .run(name, service, horario, encrypt(contact), 'pendiente', mutua, fecha_cita, phone);
      return existing.id;
    }
    const cita = generarIdCita();
    const result = db.prepare('INSERT INTO leads (phone, name, service, horario, contact, cita, mutua, fecha_cita) VALUES (?,?,?,?,?,?,?,?)')
      .run(phone, name, service, horario, encrypt(contact), cita, mutua, fecha_cita);
    return result.lastInsertRowid;
  },

  confirmLead(identifier) {
    if (typeof identifier === 'number' || /^[0-9]+$/.test(String(identifier))) {
      db.prepare("UPDATE leads SET estado='confirmado' WHERE id=?").run(identifier);
      return;
    }
    db.prepare("UPDATE leads SET estado='confirmado' WHERE phone=?").run(identifier);
  },

  saveMessage(phone, role, content) {
    db.prepare('INSERT INTO messages (phone, role, content) VALUES (?,?,?)').run(phone, role, content);
  },

  getHistory(phone, limit = 10) {
    return db.prepare('SELECT role, content FROM messages WHERE phone=? ORDER BY id DESC LIMIT ?')
      .all(phone, limit)
      .reverse();
  },

  getLeads() {
    return db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all().map(decryptLead);
  },

  getLeadById(id) {
    return decryptLead(db.prepare('SELECT * FROM leads WHERE id = ?').get(id));
  },

  getLeadByCita(cita) {
    return decryptLead(db.prepare('SELECT * FROM leads WHERE cita = ?').get(cita));
  },

  getPendingLeads() {
    return db.prepare('SELECT * FROM leads WHERE estado = ? ORDER BY created_at DESC').all('pendiente');
  },

  updateLeadEstado(id, estado) {
    return db.prepare('UPDATE leads SET estado = ? WHERE id = ?').run(estado, id);
  },

  deleteLead(id) {
    return db.prepare('DELETE FROM leads WHERE id = ?').run(id);
  },

  updateLeadDetails(id, name, service, horario, contact, mutua, fecha_cita) {
    return db.prepare('UPDATE leads SET name = ?, service = ?, horario = ?, contact = ?, mutua = ?, fecha_cita = ? WHERE id = ?')
      .run(name, service, horario, encrypt(contact), mutua, fecha_cita, id);
  },

  updateLeadNotes(id, notes) {
    return db.prepare('UPDATE leads SET notes = ? WHERE id = ?').run(encrypt(notes), id);
  },

  updateLeadProfessional(id, professional) {
    return db.prepare('UPDATE leads SET professional = ? WHERE id = ?').run(professional, id);
  },

  updateLeadDni(id, dni) {
    return db.prepare('UPDATE leads SET dni = ? WHERE id = ?').run(encrypt(dni), id);
  },

  // ── Professionals ──────────────────────────────────────────────────────────
  getProfessionals() {
    return db.prepare('SELECT * FROM professionals WHERE active = 1 ORDER BY name ASC').all();
  },

  getProfessionalById(id) {
    return db.prepare('SELECT * FROM professionals WHERE id = ?').get(id);
  },

  addProfessional(name, specialty) {
    return db.prepare('INSERT INTO professionals (name, specialty) VALUES (?, ?)').run(name, specialty);
  },

  updateProfessional(id, name, specialty) {
    return db.prepare('UPDATE professionals SET name = ?, specialty = ? WHERE id = ?').run(name, specialty, id);
  },

  deleteProfessional(id) {
    return db.prepare('UPDATE professionals SET active = 0 WHERE id = ?').run(id);
  },

  getStats() {
    const total = db.prepare("SELECT COUNT(*) as n FROM leads").get().n;
    const confirmados = db.prepare("SELECT COUNT(*) as n FROM leads WHERE estado='confirmado'").get().n;
    const rechazados = db.prepare("SELECT COUNT(*) as n FROM leads WHERE estado='rechazado'").get().n;
    const contactados = db.prepare("SELECT COUNT(*) as n FROM leads WHERE estado='contactado'").get().n;
    const pendientes = db.prepare("SELECT COUNT(*) as n FROM leads WHERE estado='pendiente'").get().n;
    const total_msgs = db.prepare("SELECT COUNT(*) as n FROM messages WHERE role='user'").get().n;
    const leadsHoy = db.prepare("SELECT COUNT(*) as n FROM leads WHERE date(created_at) = date('now')").get().n;
    const top_servicios = db.prepare("SELECT service, COUNT(*) as total FROM leads GROUP BY service ORDER BY total DESC LIMIT 5").all();
    return {
      total_leads: total,
      confirmados,
      rechazados,
      contactados,
      pendientes,
      total_msgs,
      leadsHoy,
      top_servicios
    };
  },

  // ── Users ──────────────────────────────────────────────────────────────────
  createUser(username, passwordHash, salt, name, role) {
    return db.prepare(
      'INSERT INTO users (username, password_hash, salt, name, role) VALUES (?, ?, ?, ?, ?)'
    ).run(username, passwordHash, salt, name, role);
  },

  getUserByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  getAllUsers() {
    return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  },

  updateUser(id, name, role) {
    return db.prepare('UPDATE users SET name = ?, role = ? WHERE id = ?').run(name, role, id);
  },

  setUserActive(id, active) {
    return db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active, id);
  },

  updateUserPassword(id, passwordHash, salt) {
    return db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(passwordHash, salt, id);
  },

  // ── Schedules ──────────────────────────────────────────────────────────────
  getSchedulesByProfessional(professionalId) {
    return db.prepare(
      'SELECT * FROM schedules WHERE professional_id = ? ORDER BY day_of_week ASC'
    ).all(professionalId);
  },

  setDaySchedule(professionalId, dayOfWeek, startTime, endTime, slotDuration) {
    return db.prepare(
      `INSERT OR REPLACE INTO schedules (professional_id, day_of_week, start_time, end_time, slot_duration)
       VALUES (?, ?, ?, ?, ?)`
    ).run(professionalId, dayOfWeek, startTime, endTime, slotDuration);
  },

  deleteDaySchedule(professionalId, dayOfWeek) {
    return db.prepare(
      'DELETE FROM schedules WHERE professional_id = ? AND day_of_week = ?'
    ).run(professionalId, dayOfWeek);
  },

  // ── Bookings ───────────────────────────────────────────────────────────────
  getBookingsByProfessionalAndDate(professionalId, dateSlot) {
    return db.prepare(
      'SELECT * FROM bookings WHERE professional_id = ? AND date_slot = ? ORDER BY time_slot ASC'
    ).all(professionalId, dateSlot);
  },

  getBookingsByProfessionalRange(professionalId, startDate, endDate) {
    return db.prepare(
      'SELECT * FROM bookings WHERE professional_id = ? AND date_slot >= ? AND date_slot <= ? ORDER BY date_slot ASC, time_slot ASC'
    ).all(professionalId, startDate, endDate);
  },

  createBooking(professionalId, dateSlot, timeSlot, leadId, patientName, service) {
    return db.prepare(
      `INSERT OR IGNORE INTO bookings (professional_id, date_slot, time_slot, lead_id, patient_name, service)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(professionalId, dateSlot, timeSlot, leadId, patientName, service);
  },

  updateBookingEstado(id, estado) {
    return db.prepare('UPDATE bookings SET estado = ? WHERE id = ?').run(estado, id);
  },

  deleteBooking(id) {
    return db.prepare('DELETE FROM bookings WHERE id = ?').run(id);
  },

  getBookingByLeadId(leadId) {
    return db.prepare('SELECT * FROM bookings WHERE lead_id = ?').get(leadId);
  },

  isSlotBooked(professionalId, dateSlot, timeSlot) {
    const row = db.prepare(
      'SELECT 1 FROM bookings WHERE professional_id = ? AND date_slot = ? AND time_slot = ?'
    ).get(professionalId, dateSlot, timeSlot);
    return !!row;
  },

  getAvailableSlots(professionalId, dateStr) {
    // Determine day_of_week: JS getDay() returns 0=Sun..6=Sat; we store Mon=1..Sun=7
    const jsDay = new Date(dateStr).getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const dayOfWeek = jsDay === 0 ? 7 : jsDay; // convert Sun from 0 to 7

    const schedule = db.prepare(
      'SELECT * FROM schedules WHERE professional_id = ? AND day_of_week = ? AND active = 1'
    ).get(professionalId, dayOfWeek);

    if (!schedule) return [];

    // Generate all HH:MM slots from start_time to end_time with slot_duration interval
    const slots = [];
    const [startH, startM] = schedule.start_time.split(':').map(Number);
    const [endH, endM] = schedule.end_time.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const duration = schedule.slot_duration || 30;

    for (let m = startMinutes; m < endMinutes; m += duration) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }

    // Get all booked time slots for that day
    const booked = db.prepare(
      'SELECT time_slot FROM bookings WHERE professional_id = ? AND date_slot = ?'
    ).all(professionalId, dateStr);
    const bookedSet = new Set(booked.map(r => r.time_slot));

    // Return slots not already booked
    return slots.filter(slot => !bookedSet.has(slot));
  },

  // ── Audit Logs ─────────────────────────────────────────────────────────────
  createAuditLog(userId, username, role, action, entityType, entityId, oldData, newData, ip) {
    return db.prepare(
      `INSERT INTO audit_logs (user_id, username, role, action, entity_type, entity_id, old_data, new_data, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId || null,
      username || 'system',
      role || null,
      action,
      entityType,
      entityId != null ? String(entityId) : null,
      oldData  != null ? JSON.stringify(oldData)  : null,
      newData  != null ? JSON.stringify(newData)  : null,
      ip || null
    );
  },

  getAuditLogs(limit = 100, offset = 0, entityType = null, username = null) {
    let sql = 'SELECT * FROM audit_logs';
    const params = [];
    const where = [];
    if (entityType) { where.push('entity_type = ?'); params.push(entityType); }
    if (username)   { where.push('username = ?');    params.push(username); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return db.prepare(sql).all(...params);
  },

  getAuditLogsByEntity(entityType, entityId) {
    return db.prepare(
      'SELECT * FROM audit_logs WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC'
    ).all(entityType, String(entityId));
  },

  countAuditLogs(entityType = null, username = null) {
    let sql = 'SELECT COUNT(*) as n FROM audit_logs';
    const params = [];
    const where = [];
    if (entityType) { where.push('entity_type = ?'); params.push(entityType); }
    if (username)   { where.push('username = ?');    params.push(username); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    return db.prepare(sql).get(...params).n;
  },

  // ── Clinics ────────────────────────────────────────────────────────────────
  getClinics() {
    return db.prepare('SELECT * FROM clinics WHERE active = 1 ORDER BY name ASC').all();
  },
  getClinicById(id) {
    return db.prepare('SELECT * FROM clinics WHERE id = ?').get(id);
  },
  createClinic(name, slug, address, phone, email) {
    return db.prepare('INSERT INTO clinics (name, slug, address, phone, email) VALUES (?,?,?,?,?)').run(name, slug, address, phone, email);
  },
  updateClinic(id, name, address, phone, email) {
    return db.prepare('UPDATE clinics SET name=?, address=?, phone=?, email=? WHERE id=?').run(name, address, phone, email, id);
  },

  // ── Roles ──────────────────────────────────────────────────────────────────
  getRoles() {
    return db.prepare('SELECT * FROM roles ORDER BY id ASC').all();
  },
  getRoleById(id) {
    return db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
  },
  getRoleByName(name) {
    return db.prepare('SELECT * FROM roles WHERE name = ?').get(name);
  },
  createRole(name, description) {
    return db.prepare('INSERT INTO roles (name, description, is_system) VALUES (?,?,0)').run(name, description);
  },
  updateRole(id, name, description) {
    return db.prepare('UPDATE roles SET name=?, description=? WHERE id=? AND is_system=0').run(name, description, id);
  },
  deleteRole(id) {
    return db.prepare('DELETE FROM roles WHERE id=? AND is_system=0').run(id);
  },

  // ── Permissions ────────────────────────────────────────────────────────────
  getPermissions() {
    return db.prepare('SELECT * FROM permissions ORDER BY category ASC, key ASC').all();
  },
  getRolePermissions(roleId) {
    return db.prepare(
      `SELECT p.* FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = ?
       ORDER BY p.category, p.key`
    ).all(roleId);
  },
  setRolePermissions(roleId, permissionKeys) {
    const deleteAll = db.prepare('DELETE FROM role_permissions WHERE role_id = ?');
    const insert    = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT ?, id FROM permissions WHERE key = ?');
    const tx = db.transaction((keys) => {
      deleteAll.run(roleId);
      for (const key of keys) insert.run(roleId, key);
    });
    tx(permissionKeys);
  },
  getUserPermissions(roleName) {
    const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(roleName);
    if (!role) return [];
    return db.prepare(
      `SELECT p.key FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = ?`
    ).all(role.id).map(r => r.key);
  },

  // ── Patient double-booking prevention ─────────────────────────────────────
  isPatientBooked(leadId, dateSlot, timeSlot) {
    const row = db.prepare(
      'SELECT 1 FROM bookings WHERE lead_id = ? AND date_slot = ? AND time_slot = ?'
    ).get(leadId, dateSlot, timeSlot);
    return !!row;
  },

  // ── Sessions (persistent) ──────────────────────────────────────────────────
  createSession(token, userId, username, name, role, clinicId, expires) {
    return db.prepare(
      'INSERT OR REPLACE INTO sessions (token, user_id, username, name, role, clinic_id, expires) VALUES (?,?,?,?,?,?,?)'
    ).run(token, userId, username, name, role, clinicId || 1, expires);
  },
  getSession(token) {
    return db.prepare('SELECT * FROM sessions WHERE token = ? AND expires > ?').get(token, Date.now());
  },
  deleteSession(token) {
    return db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  },
  pruneExpiredSessions() {
    return db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now());
  },
  extendSession(token, expires) {
    return db.prepare('UPDATE sessions SET expires = ? WHERE token = ?').run(expires, token);
  },

  // ── Consents (RGPD) ───────────────────────────────────────────────────────
  hasConsent(phone) {
    return !!db.prepare('SELECT id FROM consents WHERE phone = ?').get(phone);
  },
  saveConsent(phone, channel, version) {
    return db.prepare('INSERT OR IGNORE INTO consents (phone, channel, version) VALUES (?,?,?)').run(phone, channel, version);
  },

  // ── Anonymize lead ────────────────────────────────────────────────────────
  anonymizeLead(id) {
    return db.prepare(
      `UPDATE leads SET
        name = '[ANONIMIZADO]',
        phone = '[ANON-' || id || ']',
        contact = NULL,
        dni = NULL,
        notes = NULL
       WHERE id = ?`
    ).run(id);
  },

  // ── Professional FK ───────────────────────────────────────────────────────
  updateLeadProfessionalId(leadId, professionalId) {
    return db.prepare('UPDATE leads SET professional_id = ?, professional = (SELECT name FROM professionals WHERE id = ?) WHERE id = ?')
      .run(professionalId, professionalId, leadId);
  },

  // ── Filtered export ───────────────────────────────────────────────────────
  getLeadsFiltered({ from, to, estado, professional_id, mutua, service } = {}) {
    let sql = 'SELECT * FROM leads WHERE 1=1';
    const params = [];
    if (from)            { sql += ' AND date(fecha_cita) >= ?'; params.push(from); }
    if (to)              { sql += ' AND date(fecha_cita) <= ?'; params.push(to); }
    if (estado)          { sql += ' AND estado = ?'; params.push(estado); }
    if (mutua)           { sql += ' AND mutua LIKE ?'; params.push('%' + mutua + '%'); }
    if (service)         { sql += ' AND service LIKE ?'; params.push('%' + service + '%'); }
    sql += ' ORDER BY fecha_cita DESC, id DESC';
    return db.prepare(sql).all(...params).map(decryptLead);
  },
};
