// Motor de conversación — Centro Médico

const ESPECIALIDADES = {
  'familia':       { nombre: 'Medicina de Familia'              },
  'pediatria':     { nombre: 'Pediatría'                        },
  'fisioterapia':  { nombre: 'Fisioterapia y Rehabilitación'    },
  'psicologia':    { nombre: 'Psicología / Psiquiatría'         },
  'dermatologia':  { nombre: 'Dermatología / Medicina Estética' },
  'ginecologia':   { nombre: 'Ginecología y Obstetricia'        },
  'traumatologia': { nombre: 'Traumatología y Ortopedia'        },
  'nutricion':     { nombre: 'Nutrición y Dietética'            },
  'cardiologia':   { nombre: 'Cardiología'                      },
  'neurologia':    { nombre: 'Neurología'                       },
  'neumologia':    { nombre: 'Neumología / Alergología'         },
  'odontologia':   { nombre: 'Odontología'                      },
  'oftalmologia':  { nombre: 'Oftalmología / Optometría'        },
  'orl':           { nombre: 'ORL — Otorrinolaringología'       },
  'urologia':      { nombre: 'Urología y Andrología'            },
  'reumatologia':  { nombre: 'Reumatología'                     },
  'urgencia':      { nombre: 'Urgencia médica'                  },
  'otros':         { nombre: 'Otra especialidad'                }
};

// Mutuas con numeración para el menú
const MUTUAS_ALL = [
  'Particular (pago privado)',
  'Adeslas / Segurcaixa',
  'Asisa',
  'AXA Salud',
  'DKV Seguros',
  'Mapfre Salud',
  'Sanitas',
  'Cigna',
  'Mútua de Terrassa',
  'Fiatc',
  'Allianz',
  'Caser',
  'Generali',
  'Helvetia',
  'Zurich',
  'MGS',
  'Berkley',
  'IMQ',
  'Fremap / Fraternidad',
  'Previsora',
  'Asistencia Sanitaria Col·legial',
  'Vital Seguro'
];
const MUTUAS_PER_PAGE = 8;

// Palabras clave para reconocer mutuas escritas por texto libre
const MUTUA_KEYWORDS = {
  'particular': 'Particular (pago privado)',
  'privado': 'Particular (pago privado)',
  'privada': 'Particular (pago privado)',
  'ninguna': 'Particular (pago privado)',
  'sin mutua': 'Particular (pago privado)',
  'no tengo': 'Particular (pago privado)',
  'no dispongo': 'Particular (pago privado)',
  'adeslas': 'Adeslas / Segurcaixa',
  'segurcaixa': 'Adeslas / Segurcaixa',
  'asisa': 'Asisa',
  'axa': 'AXA Salud',
  'dkv': 'DKV Seguros',
  'mapfre': 'Mapfre Salud',
  'sanitas': 'Sanitas',
  'cigna': 'Cigna',
  'mutua terrassa': 'Mútua de Terrassa',
  'mutua de terrassa': 'Mútua de Terrassa',
  'terrassa': 'Mútua de Terrassa',
  'fiatc': 'Fiatc',
  'allianz': 'Allianz',
  'caser': 'Caser',
  'generali': 'Generali',
  'helvetia': 'Helvetia',
  'zurich': 'Zurich',
  'berkley': 'Berkley',
  'imq': 'IMQ',
  'mgs': 'MGS',
  'fremap': 'Fremap',
  'fraternidad': 'Fremap / Fraternidad',
  'previsora': 'Previsora'
};

const db = require('./db');

// ─── SESIONES ────────────────────────────────────────────────────────────────

const SESSION_TTL_MS = 30 * 60 * 1000;
const sessions = new Map();

function resetSession(phone) {
  sessions.set(phone, {
    step:          'inicio',
    prevStep:      null,
    name:          null,
    service:       null,
    mutua:         null,
    mutuaPage:     1,
    contactNumber: null,
    dni:           null,
    lastActivity:  Date.now()
  });
  return sessions.get(phone);
}

function startMenuSession(phone) {
  const s = resetSession(phone);
  s.step = 'menu';
  return s;
}

function getSession(phone) {
  const existing = sessions.get(phone);
  if (!existing) return resetSession(phone);
  if (Date.now() - existing.lastActivity > SESSION_TTL_MS) return resetSession(phone);
  existing.lastActivity = Date.now();
  return existing;
}

// ─── NORMALIZACIÓN ───────────────────────────────────────────────────────────

function normalizar(text) {
  if (!text) return '';
  let t = String(text);

  for (let d = 0; d <= 9; d++) {
    const dd = String(d);
    t = t.replace(new RegExp(dd + '\\uFE0F\\u20E3', 'g'), dd);
    t = t.replace(new RegExp(dd + '\\u20E3', 'g'), dd);
  }

  t = t.split('0️⃣').join('0');
  t = t.split('1️⃣').join('1');
  t = t.split('2️⃣').join('2');
  t = t.split('3️⃣').join('3');
  t = t.split('4️⃣').join('4');
  t = t.split('5️⃣').join('5');
  t = t.split('6️⃣').join('6');
  t = t.split('7️⃣').join('7');
  t = t.split('8️⃣').join('8');
  t = t.split('9️⃣').join('9');

  const trimmed = t.trim().toLowerCase();
  const aliasAtras = ['atrás', 'atras', 'back', 'volver', 'menu', 'menú', '<< volver'];
  if (aliasAtras.includes(trimmed)) return '0';

  return trimmed
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s:hm+]/g, ' ');
}

// ─── VALIDACIÓN DE NOMBRE ────────────────────────────────────────────────────

function parseName(text) {
  const nombre = text.trim();
  if (nombre.length < 2 || nombre.length > 50) return null;
  if (!/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ][a-zA-ZáéíóúüñÁÉÍÓÚÜÑ '\-]{1,49}$/.test(nombre)) return null;
  const letras = (nombre.match(/[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/g) || []).length;
  if (letras < 2) return null;
  return nombre;
}

// ─── VALIDACIÓN DE TELÉFONO ──────────────────────────────────────────────────

function parsePhone(text) {
  if (!text) return null;
  const cleaned = String(text).trim().replace(/[\s\-\.\(\)]/g, '');
  if (/^[6789][0-9]{8}$/.test(cleaned)) return cleaned;
  if (/^\+34[6789][0-9]{8}$/.test(cleaned)) return cleaned;
  if (/^0034[6789][0-9]{8}$/.test(cleaned)) return `+34${cleaned.slice(4)}`;
  return null;
}

const PALABRAS_PROHIBIDAS = [
  'pene','polla','verga','pito','pirula','cipote','rabo','falo',
  'vagina','coño','chocho','concha','almeja','papaya','vulva',
  'culo','nalgas','trasero','pompis','ano','recto',
  'semen','correrse','eyacular','masturbarse','pajarse','paja',
  'follar','coger','joder','fornicar','copular',
  'puta','prostituta','ramera','zorra','furcia','golfa',
  'marica','maricon','maricón','bollera','tortillera',
  'porno','pornografia','pornografía',
  'idiota','imbecil','imbécil','gilipollas','capullo','cabrón','cabron',
  'bastardo','mamón','mamon','subnormal','retrasado','mongolo',
  'pendejo','culero','mamada','chinga','chingada','hijo de puta',
  'hdp','hijoputa','mierda','merdé','caca','moco',
  'estupido','estúpido','burro','asno','animal','bestia',
  'p3ne','p0lla','c0ño','s3men','v4gina',
  'asdf','qwerty','zxcv','aaaa','bbbb','cccc','dddd','eeee',
  'abcd','abcde','abcdef','xdxd','jaja','lol','wtf','omg',
  'test','prueba','admin','root','user','usuario','bot','robot',
  'null','undefined','none','nada','falso','fake','anon','anonimo','anónimo',
  'ass','sex','fuck','shit','bitch','cunt','dick','cock'
];

function quitarAcentos(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function validarNombre(nombre) {
  if (!nombre || typeof nombre !== 'string') return false;
  const n = nombre.trim();
  if (n.length < 3 || n.length > 50) return false;
  if (!/^[a-záéíóúüñàèìòùâêîôûäëïöüçA-ZÁÉÍÓÚÜÑ\s\-']+$/i.test(n)) return false;
  if (/(.)\1{2,}/.test(n.toLowerCase())) return false;
  const letrasUnicas = new Set(n.toLowerCase().replace(/\s/g, '')).size;
  if (letrasUnicas < 3) return false;
  const nSin = quitarAcentos(n);
  for (const mala of PALABRAS_PROHIBIDAS) {
    if (nSin.includes(quitarAcentos(mala))) return false;
  }
  return true;
}

function validarTelefono(tel) {
  if (!tel) return false;
  const limpio = String(tel).trim().replace(/[\s\-\(\)\.]/g, '');
  return /^(\+34|0034)?[6789]\d{8}$/.test(limpio);
}

// ─── VALIDACIÓN DNI / NIE ─────────────────────────────────────────────────────

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';

function validarDNI(text) {
  const s = (text || '').trim().toUpperCase().replace(/[\s\-\.]/g, '');

  // DNI: 8 dígitos + letra
  if (/^[0-9]{8}[A-Z]$/.test(s)) {
    const num    = parseInt(s.slice(0, 8), 10);
    const letra  = s[8];
    if (LETRAS_DNI[num % 23] === letra) return s;
  }

  // NIE: X/Y/Z + 7 dígitos + letra
  if (/^[XYZ][0-9]{7}[A-Z]$/.test(s)) {
    const prefix = { X: '0', Y: '1', Z: '2' }[s[0]];
    const num    = parseInt(prefix + s.slice(1, 8), 10);
    const letra  = s[8];
    if (LETRAS_DNI[num % 23] === letra) return s;
  }

  return null;
}

// ─── VALIDACIÓN Y NORMALIZACIÓN DE MUTUA ─────────────────────────────────────

function normalizarMutua(text) {
  const t = quitarAcentos((text || '').trim().toLowerCase());

  // Detectar variantes de "particular"
  if (/particular|privad[ao]|sin mutua|no tengo|no dispongo|ninguna|no (tengo|tenemos)|pago directo/.test(t)) {
    return 'Particular (pago privado)';
  }

  // Buscar en keywords conocidas
  for (const [keyword, canonical] of Object.entries(MUTUA_KEYWORDS)) {
    if (t.includes(quitarAcentos(keyword))) return canonical;
  }

  return null; // no reconocida
}

function validarTextoMutua(text) {
  const t = (text || '').trim();
  if (t.length < 2 || t.length > 60) return false;

  // Al menos 2 letras reales
  const letters = (t.match(/[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/g) || []).length;
  if (letters < 2) return false;

  // Solo números → rechazar
  if (/^\d+$/.test(t)) return false;

  // Solo consonantes en texto largo → probable spam
  if (t.length > 4) {
    const vowels = (t.match(/[aeiouáéíóú]/gi) || []).length;
    if (vowels === 0) return false;
  }

  // Carácter repetido 4+ veces seguidas → spam
  if (/(.)\1{3,}/.test(t)) return false;

  return true;
}

function menuMutua(page = 1) {
  const start = (page - 1) * MUTUAS_PER_PAGE;
  const slice = MUTUAS_ALL.slice(start, start + MUTUAS_PER_PAGE);
  const hasMore = start + MUTUAS_PER_PAGE < MUTUAS_ALL.length;
  const EMOJIS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];
  let menu = '¿Dispone de mutua o seguro médico?\n\n';
  slice.forEach((m, i) => { menu += `${EMOJIS[i]}  ${m}\n`; });
  menu += '\n';
  if (hasMore) menu += '9️⃣  Ver más opciones ➡️\n\n';
  menu += '¿Otra mutua? Escríbala directamente.\n\n0️⃣  Volver al menú principal';
  return menu;
}

// ─── DETECCIÓN DE ESPECIALIDAD ───────────────────────────────────────────────

function detectEspecialidad(text) {
  const t = normalizar(text);

  if (/^(1\b|familia|general|cabecera|medic[oa] general|gp\b)/.test(t))               return 'familia';
  if (/^(2\b|pediatr|ni[nn][oa]|bebe|infant|hijo|hija)/.test(t))                      return 'pediatria';
  if (/^(3\b|fisio|rehabilit|osteo|espalda|cervical|lumbar|tendin|contractura)/.test(t)) return 'fisioterapia';
  if (/^(4\b|psicolog|psiquiatr|mental|ansied|depres|estres|burnout)/.test(t))        return 'psicologia';
  if (/^(5\b|dermat|piel|acne|manchas|estetica|estetic|botox|relleno)/.test(t))      return 'dermatologia';
  if (/^(6\b|ginecolog|obstetri|mujer|embaraz)/.test(t))                             return 'ginecologia';
  if (/^(7\b|traumatolog|trauma|hueso|articulac|rodilla|cadera|fractura|columna)/.test(t)) return 'traumatologia';
  if (/^(8\b|nutrici|nutri|dieta|dietista|peso|adelgaz|obesid)/.test(t))             return 'nutricion';
  if (/^(9\b|otra|otro|diferente|no se|ns\b)/.test(t))                               return 'otros';

  if (/cardiolog|corazon|tension\b|presion\b|palpitac|ecocard/.test(t))              return 'cardiologia';
  if (/neurolog|migra[nn]|cefalea|mareo|vertigo|nervio\b/.test(t))                   return 'neurologia';
  if (/neumolog|pulmon|respira|asma\b|alergi|bronquit|apnea/.test(t))                return 'neumologia';
  if (/odontolog|dental|dentista|diente|muela|boca|caries|encia/.test(t))            return 'odontologia';
  if (/oftalmolog|oculist|vista\b|ojo\b|gafas|lentilla|optomet/.test(t))             return 'oftalmologia';
  if (/\borl\b|otorrino|oido\b|nariz\b|garganta|amigdal|sinusit/.test(t))            return 'orl';
  if (/urolog|prostata|rinon|vejiga|androl/.test(t))                                 return 'urologia';
  if (/reumato|artritis|artrosis|fibromialg/.test(t))                                return 'reumatologia';
  if (/urgencia|urgente|emergencia|accidente/.test(t))                               return 'urgencia';

  return null;
}

// ─── PARSEO Y VALIDACIÓN DE HORARIO ─────────────────────────────────────────

const DIAS_MAP = {
  lunes:     'lunes',     lun: 'lunes',
  martes:    'martes',    mar: 'martes',
  miercoles: 'miercoles', mie: 'miercoles',
  jueves:    'jueves',    jue: 'jueves',
  viernes:   'viernes',   vie: 'viernes',
  sabado:    'sabado',    sab: 'sabado',
  domingo:   'domingo',   dom: 'domingo'
};

const DIA_DOW = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5 };

function parseHorario(text) {
  const t = normalizar(text);
  let dia = null;
  for (const [key, value] of Object.entries(DIAS_MAP)) {
    if (new RegExp(`\\b${key}\\b`).test(t)) { dia = value; break; }
  }
  if (!dia) return null;

  const timeMatch = t.match(/(\d{1,2})(?:[:h](\d{2}))?/);
  if (!timeMatch) return null;

  const hour   = parseInt(timeMatch[1], 10);
  const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

  if (isNaN(hour) || hour < 0 || hour > 23) return null;
  if (isNaN(minute) || minute < 0 || minute > 59) return null;

  return { day: dia, hour, minute };
}

function validarHorario({ day, hour, minute }) {
  if (day === 'domingo') {
    return 'No tenemos consulta los domingos. Atendemos de lunes a viernes de 8:00 a 20:30 h.';
  }
  if (day === 'sabado') {
    return 'Actualmente no atendemos los sábados. Nuestro horario es de lunes a viernes, de 8:00 a 20:30 h.';
  }
  if (hour < 8 || hour > 20 || (hour === 20 && minute > 30)) {
    return 'Nuestro horario de atención es de lunes a viernes, de 8:00 a 20:30 h. Por favor, elija un horario dentro de ese intervalo.';
  }
  return true;
}

function formatHorario({ day, hour, minute }) {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${day.charAt(0).toUpperCase() + day.slice(1)} a las ${hh}:${mm}`;
}

// Calcula la fecha real (YYYY-MM-DD HH:MM) a partir del día de la semana y hora
function calculateFechaCita(day, hour, minute) {
  const targetDow = DIA_DOW[day];
  if (!targetDow) return null;

  const now     = new Date();
  const todayDow = now.getDay(); // JS: 0=Dom, 1=Lun… 5=Vie
  let daysAhead  = targetDow - todayDow;

  if (daysAhead < 0) {
    daysAhead += 7;
  } else if (daysAhead === 0) {
    // Mismo día de semana: verificar si la hora ya pasó
    const candidate = new Date(now);
    candidate.setHours(hour, minute, 0, 0);
    if (candidate <= now) daysAhead = 7;
  }

  const fecha = new Date(now);
  fecha.setDate(now.getDate() + daysAhead);
  fecha.setHours(hour, minute, 0, 0);

  const pad = n => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())} ${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;
}

// ─── MENÚS ───────────────────────────────────────────────────────────────────

function menuEspecialidades() {
  return (
    '¿Qué especialidad necesita?\n\n' +
    '1️⃣  Medicina de Familia\n' +
    '2️⃣  Pediatría\n' +
    '3️⃣  Fisioterapia y Rehabilitación\n' +
    '4️⃣  Psicología / Psiquiatría\n' +
    '5️⃣  Dermatología / Medicina Estética\n' +
    '6️⃣  Ginecología y Obstetricia\n' +
    '7️⃣  Traumatología / Ortopedia\n' +
    '8️⃣  Nutrición y Dietética\n' +
    '9️⃣  Otra especialidad\n\n' +
    '🚨 Para urgencias escriba _urgencia_\n\n' +
    '0️⃣  Menú principal'
  );
}

function menuPrincipal() {
  return (
    'Bienvenido/a al *Centro Médico*.\n\n' +
    '¿En qué podemos atenderle hoy?\n\n' +
    '1️⃣  Solicitar cita médica\n' +
    '2️⃣  Nuestras especialidades\n' +
    '3️⃣  Horario, ubicación y contacto\n' +
    '4️⃣  Consultar o modificar mi cita\n' +
    '5️⃣  Mutuas y seguros médicos\n\n' +
    '_Sus datos son tratados conforme al RGPD (UE) 2016/679._'
  );
}

// ─── CONVERSACIÓN PRINCIPAL ──────────────────────────────────────────────────

function getReply(text, _history = []) {
  return 'usa_getReplyWithPhone';
}

function getReplyWithPhone(phone, text, options = {}) {
  let session = getSession(phone);
  const t             = normalizar(text);
  const contactNumber = options.contactNumber || null;

  // RGPD: require consent before any data collection
  if (!db.hasConsent(phone)) {
    if (/^(si|sí|acepto|accept|ok|vale|s[íi]|1|yes|d'acord|dacord)/i.test((text||'').trim())) {
      db.saveConsent(phone, 'telegram', '1.0');
      // Fall through to normal flow
    } else {
      return reply(
        '👋 Bienvenido/a al *Centro Médico*.\n\n' +
        'Para gestionar su cita necesitamos tratar sus datos personales y de salud ' +
        'conforme al RGPD (UE) 2016/679.\n\n' +
        '📋 *¿Qué datos tratamos?*\nNombre, teléfono, DNI/NIE y especialidad solicitada.\n\n' +
        '🏥 *Finalidad:* gestión de citas médicas.\n' +
        '📧 *Responsable:* Centro Médico · info@XXXXX.com\n\n' +
        'Puede ejercer sus derechos (acceso, rectificación, supresión) en cualquier momento ' +
        'contactando con la clínica.\n\n' +
        '✅ Escriba *Sí* para aceptar y continuar.\n\n' +
        '_Política de privacidad disponible en recepción y en nuestra web._'
      );
    }
  }

  if (t === '0') {
    if (session.prevStep) {
      session.step = session.prevStep;
      session.prevStep = null;
    } else {
      session = startMenuSession(phone);
    }
    if (session.step === 'ask_service') return reply(menuEspecialidades());
    return reply(menuPrincipal());
  }

  if (/^\/(reset|reiniciar|clear|volver|otra vez|start)$/i.test(text) ||
      /\b(hola|buenos|buenas|hey|saludos|ola|inicio|empezar|bon dia|bona tarda|buenas tardes|buenas noches)\b/.test(t)) {
    session = startMenuSession(phone);
    return reply(menuPrincipal());
  }

  // ── MENÚ ──────────────────────────────────────────────────────────────────
  if (session.step === 'inicio' || session.step === 'menu') {
    return handleMenu(phone, session, t, text);
  }

  // ── ELEGIR ESPECIALIDAD ───────────────────────────────────────────────────
  if (session.step === 'ask_service') {
    const esp = detectEspecialidad(text);

    if (esp === 'otros') {
      session.prevStep = session.step;
      session.step     = 'ask_service_free';
      return reply(
        'Disponemos de más de 30 especialidades. ¿Cuál necesita?\n\n' +
        'Por ejemplo: Cardiología, Neurología, Neumología, Oftalmología, ORL,\n' +
        'Urología, Reumatología, Endocrinología, Cirugía, Podología...\n\n' +
        'Escriba la especialidad:\n\n' +
        '0️⃣  Volver al menú principal'
      );
    }

    if (esp) {
      session.service  = esp;
      session.prevStep = session.step;
      session.step     = 'ask_name';
      const info = ESPECIALIDADES[esp] || { nombre: esp };
      return reply(`*${info.nombre}* — entendido.\n\n¿A nombre de quién registramos la cita?\n\n0️⃣  Volver al menú principal`);
    }

    return reply(menuEspecialidades());
  }

  // ── ESPECIALIDAD LIBRE ────────────────────────────────────────────────────
  if (session.step === 'ask_service_free') {
    const nombreEsp = (text || '').trim();
    if (!nombreEsp || nombreEsp.length < 3) {
      return reply('Por favor, escriba el nombre de la especialidad que necesita.\n\n0️⃣  Volver al menú principal');
    }
    session.service  = nombreEsp;
    session.prevStep = session.step;
    session.step     = 'ask_name';
    return reply(`*${nombreEsp}* — entendido.\n\n¿A nombre de quién registramos la cita?\n\n0️⃣  Volver al menú principal`);
  }

  // ── CONSULTAR CITA ────────────────────────────────────────────────────────
  if (session.step === 'consultar_cita') {
    const codigo = (text || '').trim().toUpperCase();
    if (!/^CITA-[A-Z0-9]{4}$/.test(codigo)) {
      return reply('Código no válido. El formato correcto es CITA-XXXX (ejemplo: CITA-A3F7).\n\n0️⃣  Volver al menú principal');
    }
    const lead = db.getLeadByCita(codigo);
    if (!lead) {
      return reply('No se ha encontrado ninguna cita con ese código. Por favor, compruebe que lo ha escrito correctamente.\n\n0️⃣  Volver al menú principal');
    }

    session.consultLeadId = lead.id;
    session.prevStep      = session.step;
    session.step          = 'consultar_cita_action';

    const estadoTexto = {
      pendiente:  '🕐 Pendiente de confirmar',
      confirmado: '✅ Confirmada',
      rechazado:  '❌ Cancelada',
      contactado: '📞 En seguimiento'
    }[lead.estado] || lead.estado;

    return reply(
      `📋 *Información de su cita:*\n\n` +
      `👤 Paciente: ${lead.name}\n` +
      `🏥 Especialidad: ${lead.service}\n` +
      `📅 Horario: ${lead.horario || 'No especificado'}\n` +
      `🔖 Código: ${lead.cita || ''}\n` +
      `Estado: ${estadoTexto}\n\n` +
      `¿Desea realizar algún cambio?\n` +
      `1️⃣  Cancelar esta cita\n` +
      `2️⃣  Cambiar la especialidad\n\n` +
      `0️⃣  Volver al menú principal`
    );
  }

  // ── ACCIÓN SOBRE CITA ─────────────────────────────────────────────────────
  if (session.step === 'consultar_cita_action') {
    if (t === '1') {
      db.updateLeadEstado(session.consultLeadId, 'rechazado');
      session.consultLeadId = null;
      startMenuSession(phone);
      return reply('Su cita ha sido cancelada correctamente.\n\nSi desea solicitar una nueva cita, seleccione la opción 1 desde el menú principal.\n\n0️⃣  Menú principal');
    }
    if (t === '2') {
      session.modifyingLeadId = session.consultLeadId;
      session.prevStep        = session.step;
      session.step            = 'ask_service';
      return reply(menuEspecialidades());
    }
    return reply('Responda 1 para cancelar su cita, 2 para cambiar la especialidad, o 0 para volver al menú principal.');
  }

  // ── NOMBRE ───────────────────────────────────────────────────────────────
  if (session.step === 'ask_name') {
    const nombreUsuario = (text || '').trim();
    if (!validarNombre(nombreUsuario)) {
      return reply(
        'El nombre introducido no es válido.\n\nPor favor, indíquenos su nombre y apellidos completos.\n' +
        'Ejemplo: Ana García / Carlos López\n\n0️⃣  Volver al menú principal'
      );
    }
    session.name     = nombreUsuario;
    session.prevStep = session.step;
    session.step     = 'ask_phone';
    return reply(`Gracias, ${nombreUsuario}. ¿Podría facilitarnos su número de teléfono de contacto?\n\nEjemplo: 612 345 678 o +34 612 345 678\n\n0️⃣  Volver al menú principal`);
  }

  // ── TELÉFONO ─────────────────────────────────────────────────────────────
  if (session.step === 'ask_phone') {
    const telInput = contactNumber || (text || '').trim();
    if (!validarTelefono(telInput)) {
      return reply(
        'El número de teléfono introducido no es válido.\n\nPor favor, introduzca un número de teléfono español.\n' +
        'Ejemplo: 612 345 678 o +34 612 345 678\n\n0️⃣  Volver al menú principal'
      );
    }
    let cleaned = String(telInput).trim().replace(/[\s\-\(\)\.]/g, '');
    if (/^0034/.test(cleaned)) cleaned = '+' + cleaned.slice(2);
    else if (/^34[6789]\d{8}$/.test(cleaned)) cleaned = '+' + cleaned;

    session.contactNumber = cleaned;
    session.prevStep      = session.step;
    session.step          = 'ask_dni';
    return reply(
      `Perfecto. Para verificar su identidad, ¿podría indicarnos su DNI o NIE?\n\n` +
      `Ejemplo: 12345678A o X1234567B\n\n` +
      `Si prefiere no facilitarlo, escriba *no* para continuar sin identificación.\n\n` +
      `0️⃣  Volver al menú principal`
    );
  }

  // ── DNI / NIE ─────────────────────────────────────────────────────────────
  if (session.step === 'ask_dni') {
    const raw = (text || '').trim().toLowerCase();

    // Patient skips identification
    if (/^(no|sin|omitir|saltar|paso|no quiero|no tengo|prefiero no)/.test(raw) || raw === '-') {
      session.dni       = null;
      session.mutuaPage = 1;
      session.prevStep  = session.step;
      session.step      = 'ask_mutua';
      return reply(menuMutua(1));
    }

    const dniValido = validarDNI(text);
    if (dniValido) {
      session.dni       = dniValido;
      session.mutuaPage = 1;
      session.prevStep  = session.step;
      session.step      = 'ask_mutua';
      return reply(
        `DNI/NIE verificado ✓\n\n` + menuMutua(1)
      );
    }

    return reply(
      `El documento introducido no es válido.\n\n` +
      `Por favor, introduzca su *DNI* (8 dígitos + letra) o *NIE* (X/Y/Z + 7 dígitos + letra).\n\n` +
      `Si prefiere no facilitarlo, escriba *no*.\n\n0️⃣  Volver al menú principal`
    );
  }

  // ── MUTUA (menú validado) ─────────────────────────────────────────────────
  if (session.step === 'ask_mutua') {
    const input  = (text || '').trim();
    const tNum   = normalizar(text);
    const page   = session.mutuaPage || 1;
    const start  = (page - 1) * MUTUAS_PER_PAGE;
    const slice  = MUTUAS_ALL.slice(start, start + MUTUAS_PER_PAGE);
    const hasMore = start + MUTUAS_PER_PAGE < MUTUAS_ALL.length;

    // Option 9 → next page
    if (tNum === '9' && hasMore) {
      session.mutuaPage = page + 1;
      return reply(menuMutua(session.mutuaPage));
    }

    // Numeric selection 1-8 from current page
    const num = parseInt(tNum, 10);
    if (!isNaN(num) && num >= 1 && num <= 8 && slice[num - 1]) {
      session.mutua     = slice[num - 1];
      session.mutuaPage = 1;
      session.prevStep  = session.step;
      session.step      = 'ask_time';
      return reply(
        `Anotado: *${session.mutua}*.\n\n` +
        `¿Qué día y hora prefiere para su cita?\n\n` +
        `Disponibilidad: lunes a viernes de 8:00 a 20:30 h.\n` +
        `Ejemplo: "lunes 10h", "jueves 16:30"\n\n` +
        `0️⃣  Volver al menú principal`
      );
    }

    // Text recognition
    const canonical = normalizarMutua(input);
    if (canonical) {
      session.mutua     = canonical;
      session.mutuaPage = 1;
      session.prevStep  = session.step;
      session.step      = 'ask_time';
      return reply(
        `Anotado: *${canonical}*.\n\n` +
        `¿Qué día y hora prefiere para su cita?\n\n` +
        `Disponibilidad: lunes a viernes de 8:00 a 20:30 h.\n` +
        `Ejemplo: "lunes 10h", "jueves 16:30"\n\n` +
        `0️⃣  Volver al menú principal`
      );
    }

    // Free text (unlisted insurer)
    if (validarTextoMutua(input)) {
      session.mutua     = input;
      session.mutuaPage = 1;
      session.prevStep  = session.step;
      session.step      = 'ask_time';
      return reply(
        `Anotado: *${input}*.\n\n` +
        `¿Qué día y hora prefiere para su cita?\n\n` +
        `Disponibilidad: lunes a viernes de 8:00 a 20:30 h.\n` +
        `Ejemplo: "lunes 10h", "jueves 16:30"\n\n` +
        `0️⃣  Volver al menú principal`
      );
    }

    return reply(
      'No hemos podido reconocer esa respuesta. Por favor, seleccione su mutua con un número o escríbala correctamente.\n\n' +
      menuMutua(page)
    );
  }

  // ── HORARIO ──────────────────────────────────────────────────────────────
  if (session.step === 'ask_time') {
    const horario = parseHorario(text);
    if (!horario) {
      return reply(
        'No hemos podido identificar el día y la hora. Por favor, indíquelos en el mismo mensaje:\n' +
        '  • "lunes a las 10"\n  • "miércoles 16:30"\n  • "jueves 9h"\n\n' +
        'Disponibilidad: lunes a viernes de 8:00 a 20:30 h.\n\n0️⃣  Volver al menú principal'
      );
    }

    const disponibilidad = validarHorario(horario);
    if (disponibilidad !== true) return reply(disponibilidad);

    const espNombre  = ESPECIALIDADES[session.service]?.nombre || session.service;
    const fecha_cita = calculateFechaCita(horario.day, horario.hour, horario.minute);

    const lead = {
      name:       session.name,
      service:    espNombre,
      horario:    formatHorario(horario),
      contact:    session.contactNumber,
      mutua:      session.mutua,
      dni:        session.dni,
      fecha_cita
    };
    if (session.modifyingLeadId) {
      lead.existingId = session.modifyingLeadId;
      session.modifyingLeadId = null;
    }

    startMenuSession(phone);

    return replyWithLead(
      `Su solicitud de cita ha sido registrada correctamente.\n\n` +
      `🏥 Especialidad: *${espNombre}*\n` +
      `📅 Horario preferido: ${lead.horario}\n` +
      `📞 Teléfono: ${lead.contact}\n` +
      `🏥 Cobertura: ${lead.mutua}\n\n` +
      `Nuestro equipo se pondrá en contacto con usted para confirmar la cita.\n\n` +
      `¡Gracias por contactar con el Centro Médico!`,
      lead
    );
  }

  // Fallback
  session.prevStep = session.step;
  session.step     = 'menu';
  return handleMenu(phone, session, t, text);
}

// ─── MENÚ PRINCIPAL ──────────────────────────────────────────────────────────

function handleMenu(phone, session, t, text) {

  if (/cita|reserva|appoint|solicitar|^\s*1\s*$/.test(t)) {
    const esp      = detectEspecialidad(text);
    const hasLetras = /[a-z]{3}/.test(t);
    if (esp && esp !== 'otros' && hasLetras) {
      session.prevStep = session.step;
      session.service  = esp;
      session.step     = 'ask_name';
      const info = ESPECIALIDADES[esp] || { nombre: esp };
      return reply(`*${info.nombre}* — entendido.\n\n¿A nombre de quién registramos la cita?\n\n0️⃣  Volver al menú principal`);
    }
    session.prevStep = session.step;
    session.step     = 'ask_service';
    return reply(menuEspecialidades());
  }

  if (/especialidad|servicios|que (ofrecen|teneis|tienen|hacen)|^\s*2\s*$/.test(t)) {
    return reply(
      '*Especialidades del Centro Médico:*\n\n' +
      '🩺 Medicina de Familia · Pediatría · Medicina Interna\n' +
      '🫀 Cardiología · Neumología · Alergología · Neurología\n' +
      '🦴 Traumatología · Fisioterapia · Osteopatía · Reumatología\n' +
      '🧠 Psicología · Psiquiatría · Logopedia\n' +
      '👁 Oftalmología · Optometría y Terapia Visual · ORL\n' +
      '👩‍⚕️ Ginecología y Obstetricia\n' +
      '🔬 Dermatología · Medicina Estética · DermoEstética\n' +
      '⚕️ Endocrinología · Nutrición · Urología · Andrología\n' +
      '🔪 Cirugía General · Cirugía Vascular · Neurocirugía\n' +
      '📡 Radiología · Extracciones · Podología · Enfermería\n\n' +
      '¿Desea solicitar una cita?\n\n0️⃣  Menú principal'
    );
  }

  if (/horario|hora|cuando|abierto|abren|^\s*3\s*$|ubicacion|donde|direccion/.test(t)) {
    return reply(
      '📍 *Dónde estamos:*\nXXXXX\n\n' +
      '📞 *Teléfonos:*\n111111111\n\n' +
      '📧 info@XXXXX.com\n\n' +
      '🕐 *Horario:*\nLunes a viernes: 8:00 – 20:30 h\n\n' +
      '0️⃣  Menú principal'
    );
  }

  if (/consultar|consulta|modificar|^\s*4\s*$/.test(t)) {
    session.prevStep = session.step;
    session.step     = 'consultar_cita';
    return reply('Introduzca su código de cita para consultarla o modificarla.\n\nEjemplo: CITA-A3F7\n\n0️⃣  Volver al menú principal');
  }

  if (/mutua|seguro|aseguradora|cobertura|^\s*5\s*$|adeslas|asisa|sanitas|dkv|mapfre|axa|cigna/.test(t)) {
    return reply(
      '🏥 *Mutuas y seguros aceptados:*\n\n' +
      'Adeslas · Asisa · AXA · DKV · Mapfre · Sanitas\n' +
      'Cigna · Fiatc · MGS · Mútua de Terrassa\n' +
      'Allianz · Helvetia · Caser · Generali · Berkley · IMQ\n' +
      '…y muchas más.\n\n' +
      '⚠️ ¿No encuentra su aseguradora? Llámenos:\n📞 111111111\n\n' +
      '¿Desea solicitar una cita?\n\n0️⃣  Menú principal'
    );
  }

  if (/urgencia|urgente|emergencia|accidente/.test(t)) {
    session.service  = 'urgencia';
    session.prevStep = session.step;
    session.step     = 'ask_name';
    return reply('🚨 *Urgencias médicas* — gestionamos cita preferente el mismo día.\n\nTambién puede llamarnos directamente al *111111111*.\n\n¿A nombre de quién registramos la cita de urgencia?\n\n0️⃣  Volver al menú principal');
  }

  if (/gracias|adios|hasta|bye|ok|vale|perfecto|moltes grac|fins aviat/.test(t)) {
    resetSession(phone);
    return reply('Gracias por contactar con el Centro Médico. Estamos a su disposición de lunes a viernes de 8:00 a 20:30 h.\n\n📞 111111111 · 📧 info@XXXXX.com\n\n¡Hasta pronto!');
  }

  return reply(
    'No he podido entender su consulta. Puedo ayudarle con:\n\n' +
    '1️⃣  Solicitar cita médica\n2️⃣  Nuestras especialidades\n' +
    '3️⃣  Horario, ubicación y contacto\n4️⃣  Consultar mi cita\n5️⃣  Mutuas y seguros médicos\n\n' +
    '0️⃣  Menú principal\n\n¿En qué podemos atenderle?'
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function reply(text)               { return { text, lead: null }; }
function replyWithLead(text, lead) { return { text, lead }; }

function extractCita(responseObj) {
  if (responseObj && responseObj.lead) return responseObj.lead;
  return null;
}

module.exports = { getReply, getReplyWithPhone, extractCita, validarNombre, validarTelefono };
