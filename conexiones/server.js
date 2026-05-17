const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

async function enviarCorreo({ para, asunto, html }) {
  try {
    await transporter.sendMail({
      from: `"Sistema Jurídico" <${process.env.GMAIL_USER}>`,
      to: para,
      subject: asunto,
      html
    });
    console.log(`✉️ Correo enviado a ${para}`);
  } catch (err) {
    console.error("Error enviando correo:", err.message);
  }
}

const carpetaUploads = path.join(__dirname, 'uploads');
if (!fs.existsSync(carpetaUploads)) fs.mkdirSync(carpetaUploads);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, carpetaUploads),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '_' + Math.random().toString(36).slice(2) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(pdf|doc|docx|jpg|jpeg|png|xlsx|xls)$/i.test(file.originalname);
    ok ? cb(null, true) : cb(new Error('Tipo no permitido'));
  }
});


const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = 3000;
const SESSION_TTL_MINUTES = Number(process.env.SESSION_TTL_MINUTES || 480);
const SESSION_TTL_MS = Math.max(5, SESSION_TTL_MINUTES) * 60 * 1000;
const sesiones = new Map();

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

const CASE_TYPE_ALIASES = {
  administrativos: ['administrativos', 'administrativo'],
  agrarios: ['agrarios', 'agrario'],
  amparos: ['amparos', 'amparo'],
  civiles: ['civiles', 'civil'],
  laborales: ['laborales', 'laboral'],
  mercantiles: ['mercantiles', 'mercantil'],
  penales: ['penales', 'penal'],
  exp_varios: ['exp_varios', 'varios', 'exp varios']
};

const CASE_TABLES = {
  amparos: {
    numero: 't.no',
    fecha: 't.fecha_emplazamiento',
    juzgado: 't.juzgado',
    demandado: 't.demandado',
    asunto: 't.asunto'
  },
  administrativos: {
    numero: 't.numero',
    fecha: 't.fecha_emplazamiento',
    juzgado: 't.sala',
    demandado: 't.autoridad_demandada_demandado',
    asunto: 't.asunto'
  },
  laborales: {
    numero: 't.numero',
    fecha: 't.emplazamiento',
    juzgado: 't.mesa',
    demandado: 'NULL',
    asunto: 'NULL'
  },
  civiles: {
    numero: 't.no',
    fecha: 't.fecha_inicio',
    juzgado: 't.juzgado',
    demandado: 't.demandado',
    asunto: 't.asunto'
  },
  mercantiles: {
    numero: 't.no',
    fecha: 't.fecha',
    juzgado: 't.juzgado',
    demandado: 'NULL',
    asunto: 't.asunto'
  },
  penales: {
    numero: 't.numero',
    fecha: 'NULL',
    juzgado: 't.juzgado',
    demandado: 't.demandado',
    asunto: 't.asunto'
  },
  agrarios: {
    numero: 't.numero',
    fecha: 't.fecha_emplazamiento',
    juzgado: 't.juzgado',
    demandado: 'NULL',
    asunto: 't.asunto'
  },
  exp_varios: {
    numero: 't.numero',
    fecha: 't.fecha_recibido',
    juzgado: 't.juzgado',
    demandado: 't.demandado',
    asunto: 't.asunto'
  }
};

const CASE_TYPE_TO_TABLE = Object.entries(CASE_TYPE_ALIASES).reduce((acc, [table, aliases]) => {
  aliases.forEach(alias => {
    acc[alias] = table;
  });
  return acc;
}, {});

function normalizarTipoCaso(tipo) {
  const limpio = String(tipo || '').trim().toLowerCase();
  if (!limpio) return '';

  return CASE_TYPE_TO_TABLE[limpio] || '';
}

function obtenerVariantesTipoCaso(tipo) {
  const canonico = normalizarTipoCaso(tipo);
  if (!canonico) return [];
  return [...new Set((CASE_TYPE_ALIASES[canonico] || [canonico]).map(valor => valor.toLowerCase()))];
}

function obtenerTablaCaso(tipo) {
  return normalizarTipoCaso(tipo);
}

function normalizarRol(rol) {
  return String(rol || '').trim().toUpperCase();
}

function esAdmin(rol) {
  return normalizarRol(rol) === 'ADMIN';
}

function puedeGestionarCasos(rol) {
  return ['ADMIN', 'SECRETARIA'].includes(normalizarRol(rol));
}

function esGestorNotas(rol) {
  return ['ADMIN', 'SECRETARIA'].includes(normalizarRol(rol));
}

function tieneAccesoCompletoCasos(rol) {
  return ['ADMIN', 'SECRETARIA'].includes(normalizarRol(rol));
}

function normalizarUsuarioId(usuarioId) {
  const limpio = String(usuarioId || '').trim();
  return limpio && limpio !== 'undefined' && limpio !== 'null' ? limpio : '';
}

function tieneAbogadoAsignado(abogado) {
  const limpio = String(abogado || '').trim();
  return Boolean(limpio && limpio !== '0' && limpio.toLowerCase() !== 'sin asignar');
}

function estadoAutomaticoPorAsignacion(estado, abogado) {
  if (tieneAbogadoAsignado(abogado)) return 'asignado';
  return estado || 'sin_asignar';
}

function crearSesion(usuario) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const usuarioSesion = {
    id: usuario.id,
    username: usuario.username,
    nombre: usuario.nombre,
    rol: normalizarRol(usuario.rol)
  };

  sesiones.set(token, { usuario: usuarioSesion, expiresAt });
  return { token, expiresAt, usuario: usuarioSesion };
}

function limpiarSesionesExpiradas() {
  const ahora = Date.now();
  for (const [token, sesion] of sesiones.entries()) {
    if (!sesion || sesion.expiresAt <= ahora) sesiones.delete(token);
  }
}

function obtenerTokenSesion(req) {
  const auth = req.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function autenticarSesion(req, res, next) {
  limpiarSesionesExpiradas();
  const token = obtenerTokenSesion(req);

  if (!token || !sesiones.has(token)) {
    return res.status(401).json({
      success: false,
      code: 'SESSION_REQUIRED',
      mensaje: 'Inicia sesión para continuar.'
    });
  }

  const sesion = sesiones.get(token);
  if (sesion.expiresAt <= Date.now()) {
    sesiones.delete(token);
    return res.status(401).json({
      success: false,
      code: 'SESSION_EXPIRED',
      mensaje: 'Tu sesión expiró. Inicia sesión de nuevo.'
    });
  }

  req.authToken = token;
  req.auth = sesion.usuario;
  req.sessionExpiresAt = sesion.expiresAt;

  req.query.rol = req.auth.rol;
  req.query.usuario_id = String(req.auth.id);
  req.query.usuario = req.auth.username || req.auth.nombre || '';

  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    req.body.rol = req.auth.rol;
    req.body.usuario_id = String(req.auth.id);
  }

  res.set('X-Session-Expires-At', new Date(sesion.expiresAt).toISOString());
  next();
}

function construirSelectCasos() {
  return Object.entries(CASE_TABLES).map(([tabla, cfg]) => `
    SELECT
      '${tabla}' AS tipo,
      t.id,
      ${cfg.numero} AS numero,
      t.expediente,
      ${cfg.fecha} AS fecha,
      ${cfg.juzgado} AS juzgado,
      t.actor,
      ${cfg.demandado} AS demandado,
      ${cfg.asunto} AS asunto,
      t.estado_procesal,
      t.prioridad,
      t.created_at,
      t.abogado_encargado,
      t.abogado_colaborador,
      u.nombre AS nombre_abogado,
      uc.nombre AS nombre_abogado_colaborador
    FROM ${tabla} t
    LEFT JOIN usuarios u ON CAST(NULLIF(t.abogado_encargado, '') AS UNSIGNED) = u.id
    LEFT JOIN usuarios uc ON CAST(NULLIF(t.abogado_colaborador, '') AS UNSIGNED) = uc.id
  `).join(' UNION ALL ');
}

function aplicarAccesoCaso(condiciones, params, rol, usuarioId) {
  if (tieneAccesoCompletoCasos(rol)) return;

  const id = normalizarUsuarioId(usuarioId);
  if (!id) {
    condiciones.push('1 = 0');
    return;
  }

  condiciones.push(`(
    CAST(casos.abogado_encargado AS CHAR) = ?
    OR CAST(casos.abogado_colaborador AS CHAR) = ?
  )`);
  params.push(id, id);
}

function verificarAccesoCaso(tipoCaso, casoId, rol, usuarioId, callback) {
  const tabla = obtenerTablaCaso(tipoCaso);
  if (!tabla) {
    return callback(null, false, 'tipo_caso es obligatorio.');
  }

  if (tieneAccesoCompletoCasos(rol)) {
    return callback(null, true);
  }

  const id = normalizarUsuarioId(usuarioId);
  if (!id) return callback(null, false);

  const sql = `
    SELECT id
    FROM ${tabla}
    WHERE id = ?
      AND (
        CAST(abogado_encargado AS CHAR) = ?
        OR CAST(abogado_colaborador AS CHAR) = ?
      )
    LIMIT 1
  `;

  db.query(sql, [casoId, id, id], (err, rows) => {
    if (err) return callback(err);
    callback(null, rows.length > 0);
  });
}

async function asegurarCompatibilidadBD() {
  const pdb = db.promise();

  for (const tabla of Object.keys(CASE_TABLES)) {
    const [cols] = await pdb.query(`SHOW COLUMNS FROM ${tabla} LIKE 'abogado_colaborador'`);
    if (!cols.length) {
      await pdb.query(`ALTER TABLE ${tabla} ADD COLUMN abogado_colaborador TEXT NULL`);
    }
  }
}


db.connect(err => {
  if (err) {
    console.error('Error conectando a la base de datos:', err);
    return;
  }
    db.query("SET time_zone = '-06:00'");
  console.log('¡Conectado exitosamente a MySQL!');
  asegurarCompatibilidadBD()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Servidor Backend corriendo y escuchando en http://localhost:${PORT}`);
      });
    })
    .catch(error => {
      console.error('Error preparando la base de datos:', error);
      process.exit(1);
    });
});


app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({
      success: false,
      mensaje: "Usuario y contraseña son obligatorios"
    });
  }

  const passwordHash = crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');

  const sql = "SELECT * FROM usuarios WHERE username = ? AND password_hash = ?";

  db.query(sql, [usuario, passwordHash], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        mensaje: "Error interno del servidor"
      });
    }

    if (results.length > 0) {
      const usuarioEncontrado = results[0];
      const rolesPermitidos = ["ADMIN", "ABOGADO", "SECRETARIA"];
      const rolNormalizado = normalizarRol(usuarioEncontrado.rol);

      if (!Number(usuarioEncontrado.activo)) {
        return res.status(403).json({
          success: false,
          mensaje: "Tu usuario está inactivo."
        });
      }

      if (rolesPermitidos.includes(rolNormalizado)) {
        const sesion = crearSesion({
          ...usuarioEncontrado,
          rol: rolNormalizado
        });
        const expiresAt = new Date(sesion.expiresAt).toISOString();

        return res.json({
          success: true,
          mensaje: "¡Bienvenido!",
          token: sesion.token,
          expiresAt,
          usuario: {
            id: usuarioEncontrado.id,
            username: usuarioEncontrado.username,
            nombre: usuarioEncontrado.nombre,
            rol: rolNormalizado,
            token: sesion.token,
            expiresAt
          }
        });
      } else {
        return res.status(403).json({
          success: false,
          mensaje: "Acceso denegado."
        });
      }
    } else {
      return res.status(401).json({
        success: false,
        mensaje: "Usuario o contraseña incorrectos"
      });
    }
  });
});

app.use('/api', autenticarSesion);

app.get('/api/session', (req, res) => {
  res.json({
    success: true,
    usuario: req.auth,
    expiresAt: new Date(req.sessionExpiresAt).toISOString()
  });
});

app.post('/api/logout', (req, res) => {
  if (req.authToken) sesiones.delete(req.authToken);
  res.json({ success: true });
});

// Agregar casos
// Ruta para agregar un nuevo caso
app.post('/api/nuevocaso', (req, res) => {
  if (!puedeGestionarCasos(req.auth?.rol)) {
    return res.status(403).json({
      success: false,
      mensaje: "No tienes permisos para crear casos."
    });
  }

  //console.log("BODY:", req.body);
  const {
    tipo_caso,
    expediente,
    estado_procesal,
    asunto,
    prioridad,
    abogado_encargado,
    fecha_emplazamiento,
    juzgado,
    actor,
    demandado,
    sala,
    mesa,
    numero
  } = req.body;

  let sql = "";
  let params = [];
  const tipo = tipo_caso ? tipo_caso.toLowerCase() : '';
  const estadoProcesalFinal = estadoAutomaticoPorAsignacion(estado_procesal, abogado_encargado);

  // Mapeo exacto según tu bdjuridico.sql
  // ----------------- Modificacion echa por Fer el 18 -------------------------
  switch (tipo) {
    case 'amparo':
      sql = `INSERT INTO amparos 
      (expediente, fecha_emplazamiento, estado_procesal, asunto, juzgado, actor, demandado, abogado_encargado, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, fecha_emplazamiento, estadoProcesalFinal, asunto, juzgado, actor, demandado, abogado_encargado, prioridad];
      break;

    case 'administrativo':
      sql = `INSERT INTO administrativos 
      (expediente, estado_procesal, asunto, fecha_emplazamiento, sala, actor, abogado_encargado, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, estadoProcesalFinal, asunto, fecha_emplazamiento, sala, actor, abogado_encargado, prioridad];
      break;

    case 'laboral':
      sql = `INSERT INTO laborales 
      (expediente, estado_procesal, actor, emplazamiento, mesa, numero, abogado_encargado, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, estadoProcesalFinal, actor, fecha_emplazamiento, mesa, numero, abogado_encargado, prioridad];
      break;

    case 'civil':
      sql = `INSERT INTO civiles 
      (expediente, estado_procesal, asunto, fecha_inicio, juzgado, actor, demandado, abogado_encargado, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, estadoProcesalFinal, asunto, fecha_emplazamiento, juzgado, actor, demandado, abogado_encargado, prioridad];
      break;

    case 'mercantil':
      sql = `INSERT INTO mercantiles 
      (expediente, estado_procesal, asunto, fecha, juzgado, actor, abogado_encargado, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, estadoProcesalFinal, asunto, fecha_emplazamiento, juzgado, actor, abogado_encargado, prioridad];
      break;

    case 'penal':
      // ⚠️ penales NO tiene fecha_emplazamiento en tu schema
      sql = `INSERT INTO penales 
     (expediente, estado_procesal, asunto, juzgado, actor, demandado, abogado_encargado, prioridad, estado_id) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`;

      params = [expediente, estadoProcesalFinal, asunto, juzgado, actor, demandado, abogado_encargado, prioridad];
      break;

    case 'agrario':
      // ⚠️ agrarios NO tiene demandado en tu schema
      sql = `INSERT INTO agrarios 
      (expediente, estado_procesal, asunto, fecha_emplazamiento, actor, abogado_encargado, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, estadoProcesalFinal, asunto, fecha_emplazamiento, actor, abogado_encargado, prioridad];
      break;

    case 'varios':
      sql = `INSERT INTO exp_varios 
      (expediente, estado_procesal, asunto, fecha_recibido,abogado_encargado, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, estadoProcesalFinal, asunto, fecha_emplazamiento, abogado_encargado, prioridad];
      break;

    default:
      return res.status(400).json({
        success: false,
        mensaje: "Tipo de caso '" + tipo + "' no registrado."
      });
  }

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error("Error de MySQL:", err.sqlMessage);
      return res.status(500).json({ success: false, mensaje: "Error en DB: " + err.sqlMessage });
    }
    res.json({ success: true, mensaje: "¡Caso guardado!", id: result.insertId });
  });
});
//-----------------PRUEBA-------------------------
app.get('/api/casos', (req, res) => {
  const tipoRecibido = req.query.tipo;
  const busqueda = (req.query.busqueda || "").trim();
  const archivados = String(req.query.archivados || "0");
  const estadoFiltro = String(req.query.estado || "").trim().toLowerCase();
  const rol = req.auth?.rol || normalizarRol(req.query.rol);
  const usuarioId = normalizarUsuarioId(req.auth?.id || req.query.usuario_id);

  let sql = `SELECT * FROM (${construirSelectCasos()}) casos`;
  let params = [];
  const condiciones = [];

  // Filtro por tipo
  if (tipoRecibido && tipoRecibido !== "Todos") {
    const tipoBD = normalizarTipoCaso(tipoRecibido);
    if (!tipoBD) {
      return res.status(400).json({ success: false, mensaje: "Tipo no válido" });
    }
    condiciones.push("tipo = ?");
    params.push(tipoBD);
  }

  // Filtro por archivados / activos
  if (archivados === "1") {
  condiciones.push("LOWER(COALESCE(estado_procesal, '')) = 'archivado'");
  } else {
    
  condiciones.push("LOWER(COALESCE(estado_procesal, '')) != 'archivado'");
  }

  if (estadoFiltro) {
  condiciones.push("LOWER(REPLACE(COALESCE(estado_procesal, ''), ' ', '_')) = ?");
  params.push(estadoFiltro);
}

  // Filtro por búsqueda: expediente, partes, asunto y abogados asignados
  if (busqueda) {
    condiciones.push(
      `(
        expediente LIKE ?
        OR actor LIKE ?
        OR demandado LIKE ?
        OR asunto LIKE ?
        OR nombre_abogado LIKE ?
        OR nombre_abogado_colaborador LIKE ?
        OR CAST(abogado_encargado AS CHAR) LIKE ?
        OR CAST(abogado_colaborador AS CHAR) LIKE ?
      )`
    );
    const termino = `%${busqueda}%`;
    params.push(termino, termino, termino, termino, termino, termino, termino, termino);
  }

  aplicarAccesoCaso(condiciones, params, rol, usuarioId);

  if (condiciones.length > 0) {
    sql += " WHERE " + condiciones.join(" AND ");
  }

  const limite = parseInt(req.query.limite) || 5;
  const pagina = parseInt(req.query.pagina) || 1;
  const offset = (pagina - 1) * limite;

  if (req.query.orden === 'prioridad_desc') {
    sql += `
      ORDER BY
        CASE LOWER(COALESCE(prioridad, 'media'))
          WHEN 'alta' THEN 1
          WHEN 'media' THEN 2
          WHEN 'baja' THEN 3
          ELSE 4
        END ASC,
        created_at DESC
    `;
  } else {
    sql += " ORDER BY created_at DESC";
  }

  sql += " LIMIT ? OFFSET ?";
  params.push(limite, offset);

  console.log("SQL:", sql);
  console.log("PARAMS:", params);

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("ERROR MYSQL:", err);
      return res.status(500).json({
        success: false,
        mensaje: "Error al consultar casos"
      });
    }
    // ----------------- Modificacion echa por Fer el 18 -------------------------
    const casos = results.map(caso => ({
      id: caso.id,
      id_display: `${caso.tipo.toUpperCase()}-${caso.id}`,
      fecha: caso.fecha || caso.created_at || "Sin fecha",
      expediente: caso.expediente || "",
      nombre: caso.asunto || caso.actor || caso.expediente || "Sin nombre",
      tipo: caso.tipo,
      tipo_db: normalizarTipoCaso(caso.tipo) || caso.tipo,
      prioridad: caso.prioridad || "Media",
      estado: caso.estado_procesal || "—",
      asignado: [caso.nombre_abogado, caso.nombre_abogado_colaborador].filter(Boolean).join(" + ") || "Sin asignar",
      abogado_encargado: caso.abogado_encargado,
      abogado_colaborador: caso.abogado_colaborador,
      nombre_abogado: caso.nombre_abogado,
      nombre_abogado_colaborador: caso.nombre_abogado_colaborador
    }));

    res.json({
      success: true,
      casos,
      pagina,
      limite
    });
  });
});

app.get('/api/dashboard/kpis', (req, res) => {
  const rol = req.auth?.rol || normalizarRol(req.query.rol);
  const usuarioId = normalizarUsuarioId(req.auth?.id || req.query.usuario_id);
  const condiciones = [];
  const params = [];
  const estadoActivo = "LOWER(COALESCE(estado_procesal, '')) NOT IN ('archivado', 'finalizado')";
  const sinAbogado = `
    (
      abogado_encargado IS NULL
      OR TRIM(CAST(abogado_encargado AS CHAR)) = ''
      OR TRIM(CAST(abogado_encargado AS CHAR)) = '0'
      OR LOWER(TRIM(CAST(abogado_encargado AS CHAR))) IN ('sin asignar', 'por asignar', 'por reasignar')
      OR LOWER(COALESCE(estado_procesal, '')) IN ('sin_asignar', 'sin asignar')
    )
  `;

  aplicarAccesoCaso(condiciones, params, rol, usuarioId);

  let sql = `
    SELECT
      COALESCE(SUM(CASE WHEN ${estadoActivo} THEN 1 ELSE 0 END), 0) AS casos_activos,
      COALESCE(SUM(CASE WHEN ${estadoActivo} AND LOWER(COALESCE(prioridad, '')) = 'alta' THEN 1 ELSE 0 END), 0) AS alta_prioridad,
      COALESCE(SUM(CASE WHEN ${estadoActivo} AND ${sinAbogado} THEN 1 ELSE 0 END), 0) AS por_reasignar
    FROM (${construirSelectCasos()}) casos
  `;

  if (condiciones.length > 0) {
    sql += " WHERE " + condiciones.join(" AND ");
  }

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("Error consultando KPIs:", err);
      return res.status(500).json({ success: false, mensaje: "Error al consultar KPIs" });
    }

    const recordatorioSql = rol === 'ADMIN'
      ? "SELECT COUNT(*) AS total FROM recordatorios WHERE visto = FALSE"
      : "SELECT COUNT(*) AS total FROM recordatorios WHERE visto = FALSE AND destinatario_id = ?";
    const recordatorioParams = rol === 'ADMIN' ? [] : [usuarioId];

    db.query(recordatorioSql, recordatorioParams, (recErr, recRows) => {
      if (recErr) {
        console.error("Error consultando recordatorios KPI:", recErr);
        return res.status(500).json({ success: false, mensaje: "Error al consultar recordatorios" });
      }

      const kpis = rows[0] || {};
      res.json({
        success: true,
        kpis: {
          casosActivos: Number(kpis.casos_activos || 0),
          altaPrioridad: Number(kpis.alta_prioridad || 0),
          porReasignar: Number(kpis.por_reasignar || 0),
          recordatorios: Number(recRows?.[0]?.total || 0)
        }
      });
    });
  });
});

// GET /api/usuarios → lista de usuarios
app.get('/api/usuarios', (req, res) => {
  const sql = `SELECT id, nombre, username, rol, email, activo FROM usuarios ORDER BY id ASC`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, mensaje: err.message });
    res.json({ success: true, usuarios: results });
  });
});

app.post('/api/usuarios', (req, res) => {
  if (!esAdmin(req.auth?.rol)) {
    return res.status(403).json({ success: false, mensaje: "No tienes permisos para crear usuarios." });
  }

  const { nombre, username, email, rol, password, activo } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, mensaje: "Usuario y contraseña son obligatorios." });
  }

  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

  const sql = `INSERT INTO usuarios (nombre, username, email, rol, password_hash, activo) 
               VALUES (?, ?, ?, ?, ?, ?)`;
  const params = [nombre, username, email, rol || 'ABOGADO', passwordHash, activo ?? 1];

  db.query(sql, params, (err, result) => {
    if (err) {
      // Detecta username o email duplicado
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, mensaje: "El usuario o correo ya existe." });
      }
      // Detecta triggers de ADMIN/SECRETARIA únicos
      if (err.sqlState === '45000') {
        return res.status(409).json({ success: false, mensaje: err.message });
      }
      return res.status(500).json({ success: false, mensaje: err.message });
    }
    res.json({ success: true, mensaje: "Usuario creado.", id: result.insertId });
  });
});
// PUT /api/usuarios/:id → editar usuario
app.put('/api/usuarios/:id', (req, res) => {
  if (!esAdmin(req.auth?.rol)) {
    return res.status(403).json({ success: false, mensaje: "No tienes permisos para editar usuarios." });
  }

  const { id } = req.params;
  const { nombre, username, email, rol, activo, password } = req.body;

  if (!nombre || !username) {
    return res.status(400).json({ success: false, mensaje: 'Nombre y usuario son obligatorios.' });
  }

  const rolesValidos = ['ADMIN', 'ABOGADO', 'SECRETARIA'];
  if (rol && !rolesValidos.includes(rol)) {
    return res.status(400).json({ success: false, mensaje: 'Rol no válido.' });
  }

  if (password) {
    // Actualizar también la contraseña
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    const sql = `UPDATE usuarios SET nombre=?, username=?, email=?, rol=?, activo=?, password_hash=? WHERE id=?`;
    db.query(sql, [nombre, username, email || null, rol || 'ABOGADO', activo ?? 1, passwordHash, id], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ success: false, mensaje: 'El usuario o correo ya existe.' });
        }
        if (err.sqlState === '45000') {
          return res.status(409).json({ success: false, mensaje: err.message });
        }
        return res.status(500).json({ success: false, mensaje: err.message });
      }
      if (!result.affectedRows) {
        return res.status(404).json({ success: false, mensaje: 'Usuario no encontrado.' });
      }
      res.json({ success: true, mensaje: 'Usuario actualizado correctamente.' });
    });
  } else {
    // Sin cambio de contraseña
    const sql = `UPDATE usuarios SET nombre=?, username=?, email=?, rol=?, activo=? WHERE id=?`;
    db.query(sql, [nombre, username, email || null, rol || 'ABOGADO', activo ?? 1, id], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ success: false, mensaje: 'El usuario o correo ya existe.' });
        }
        if (err.sqlState === '45000') {
          return res.status(409).json({ success: false, mensaje: err.message });
        }
        return res.status(500).json({ success: false, mensaje: err.message });
      }
      if (!result.affectedRows) {
        return res.status(404).json({ success: false, mensaje: 'Usuario no encontrado.' });
      }
      res.json({ success: true, mensaje: 'Usuario actualizado correctamente.' });
    });
  }
});

// ─────────────────────────────────────────
// ENDPOINTS DE DOCUMENTOS
// ─────────────────────────────────────────

// GET  /api/documentos/:casoId  → lista
app.get('/api/documentos/:casoId', (req, res) => {
  const tipoCaso = normalizarTipoCaso(req.query.tipo_caso);
  if (!tipoCaso) {
    return res.status(400).json({ success: false, mensaje: 'tipo_caso es obligatorio.' });
  }

  verificarAccesoCaso(tipoCaso, req.params.casoId, req.query.rol, req.query.usuario_id, (accessErr, permitido) => {
    if (accessErr) return res.status(500).json({ success: false, mensaje: accessErr.message });
    if (!permitido) return res.status(403).json({ success: false, mensaje: 'No tienes acceso a este caso.' });

    const sql = `SELECT id, nombre_original, tamaño, subido_por,
                        DATE_FORMAT(created_at,'%d/%m/%Y %H:%i') AS fecha
                 FROM documentos
                 WHERE caso_id = ? AND tipo_caso = ?
                 ORDER BY created_at DESC`;
    db.query(sql, [req.params.casoId, tipoCaso], (err, rows) => {
      if (err) return res.status(500).json({ success: false, mensaje: err.message });
      res.json({ success: true, documentos: rows });
    });
  });
});

// POST /api/documentos/:casoId  → sube archivo
app.post('/api/documentos/:casoId', upload.single('archivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, mensaje: 'Sin archivo' });
  const tipoCaso = normalizarTipoCaso(req.body.tipo_caso);
  if (!tipoCaso) {
    return res.status(400).json({ success: false, mensaje: 'tipo_caso es obligatorio.' });
  }

  verificarAccesoCaso(tipoCaso, req.params.casoId, req.auth?.rol, req.auth?.id, (accessErr, permitido) => {
    if (accessErr) return res.status(500).json({ success: false, mensaje: accessErr.message });
    if (!permitido) {
      if (req.file?.filename) {
        const ruta = path.join(__dirname, 'uploads', req.file.filename);
        if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
      }
      return res.status(403).json({ success: false, mensaje: 'No tienes acceso a este caso.' });
    }

    const sql = `INSERT INTO documentos
                 (caso_id, tipo_caso, nombre_original, nombre_archivo, mimetype, tamaño, subido_por)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.query(sql,
      [req.params.casoId, tipoCaso, req.file.originalname, req.file.filename,
      req.file.mimetype, req.file.size, req.auth?.nombre || req.auth?.username || 'Sistema'],
      (err, r) => {
        if (err) return res.status(500).json({ success: false, mensaje: err.message });
        res.json({ success: true, id: r.insertId });
      }
    );
  });
});

// GET  /api/documentos/descargar/:docId  → descarga
app.get('/api/documentos/descargar/:docId', (req, res) => {
  db.query('SELECT caso_id, tipo_caso, nombre_original, nombre_archivo FROM documentos WHERE id = ?',
    [req.params.docId], (err, rows) => {
      if (err || !rows.length)
        return res.status(404).json({ success: false, mensaje: 'No encontrado' });

      const doc = rows[0];
      verificarAccesoCaso(doc.tipo_caso, doc.caso_id, req.query.rol, req.query.usuario_id, (accessErr, permitido) => {
        if (accessErr) return res.status(500).json({ success: false, mensaje: accessErr.message });
        if (!permitido) return res.status(403).json({ success: false, mensaje: 'No tienes acceso a este documento.' });

        const ruta = path.join(__dirname, 'uploads', doc.nombre_archivo);
        if (!fs.existsSync(ruta))
          return res.status(404).json({ success: false, mensaje: 'Archivo eliminado del servidor' });
        res.download(ruta, doc.nombre_original);
      });
    });
});

// GET  /api/documentos/ver/:docId  → visualización inline
app.get('/api/documentos/ver/:docId', (req, res) => {
  db.query('SELECT caso_id, tipo_caso, nombre_original, nombre_archivo, mimetype FROM documentos WHERE id = ?',
    [req.params.docId], (err, rows) => {
      if (err || !rows.length)
        return res.status(404).json({ success: false, mensaje: 'No encontrado' });

      const doc = rows[0];
      verificarAccesoCaso(doc.tipo_caso, doc.caso_id, req.query.rol, req.query.usuario_id, (accessErr, permitido) => {
        if (accessErr) return res.status(500).json({ success: false, mensaje: accessErr.message });
        if (!permitido) return res.status(403).json({ success: false, mensaje: 'No tienes acceso a este documento.' });

        const ruta = path.join(__dirname, 'uploads', doc.nombre_archivo);
        if (!fs.existsSync(ruta))
          return res.status(404).json({ success: false, mensaje: 'Archivo eliminado del servidor' });

        res.setHeader('Content-Type', doc.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nombre_original)}"`);
        res.sendFile(ruta);
      });
    });
});
// DELETE /api/documentos/:docId  → elimina
app.delete('/api/documentos/:docId', (req, res) => {
  db.query('SELECT caso_id, tipo_caso, nombre_archivo FROM documentos WHERE id = ?',
    [req.params.docId], (err, rows) => {
      if (err || !rows.length)
        return res.status(404).json({ success: false, mensaje: 'No encontrado' });

      const doc = rows[0];
      verificarAccesoCaso(doc.tipo_caso, doc.caso_id, req.query.rol, req.query.usuario_id, (accessErr, permitido) => {
        if (accessErr) return res.status(500).json({ success: false, mensaje: accessErr.message });
        if (!permitido) return res.status(403).json({ success: false, mensaje: 'No tienes acceso a este documento.' });

        // Borrar del disco
        const ruta = path.join(__dirname, 'uploads', doc.nombre_archivo);
        if (fs.existsSync(ruta)) fs.unlinkSync(ruta);

        // Borrar de la BD
        db.query('DELETE FROM documentos WHERE id = ?', [req.params.docId], err2 => {
          if (err2) return res.status(500).json({ success: false, mensaje: err2.message });
          res.json({ success: true });
        });
      });
    });
});


// ─────────────────────────────────────────
// ENDPOINTS DE NOTAS
// ─────────────────────────────────────────

// GET /api/casos/:id/notas → lista de notas
app.get('/api/casos/:id/notas', (req, res) => {
  const tiposCompatibles = obtenerVariantesTipoCaso(req.query.tipo_caso);
  if (!tiposCompatibles.length) {
    return res.status(400).json({ success: false, mensaje: 'tipo_caso es obligatorio.' });
  }

  verificarAccesoCaso(req.query.tipo_caso, req.params.id, req.query.rol, req.query.usuario_id, (accessErr, permitido) => {
    if (accessErr) return res.status(500).json({ success: false, mensaje: accessErr.message });
    if (!permitido) return res.status(403).json({ success: false, mensaje: 'No tienes acceso a este caso.' });

    const placeholders = tiposCompatibles.map(() => '?').join(', ');
    const sql = `SELECT id, texto, usuario,
                        DATE_FORMAT(created_at,'%d/%m/%Y %H:%i') AS fecha
                 FROM notas_caso
                 WHERE caso_id = ? AND LOWER(tipo_caso) IN (${placeholders})
                 ORDER BY created_at DESC`;
    db.query(sql, [req.params.id, ...tiposCompatibles], (err, rows) => {
      if (err) return res.status(500).json({ success: false, mensaje: err.message });
      res.json({ success: true, notas: rows });
    });
  });
});

// POST /api/casos/:id/notas → guardar nota
app.post('/api/casos/:id/notas', (req, res) => {
  const { texto, usuario, tipo_caso, rol, usuario_id } = req.body;
  const tipoCaso = normalizarTipoCaso(tipo_caso);
  if (!texto || !texto.trim()) {
    return res.status(400).json({ success: false, mensaje: 'El texto es obligatorio.' });
  }
  if (!tipoCaso) {
    return res.status(400).json({ success: false, mensaje: 'tipo_caso es obligatorio.' });
  }

  verificarAccesoCaso(tipoCaso, req.params.id, rol, usuario_id, (accessErr, permitido) => {
    if (accessErr) return res.status(500).json({ success: false, mensaje: accessErr.message });
    if (!permitido) return res.status(403).json({ success: false, mensaje: 'No tienes acceso a este caso.' });

    const sql = `INSERT INTO notas_caso (caso_id, tipo_caso, texto, usuario) VALUES (?, ?, ?, ?)`;
    db.query(sql, [req.params.id, tipoCaso, texto.trim(), usuario || 'Sistema'], (err, result) => {
      if (err) return res.status(500).json({ success: false, mensaje: err.message });
      res.json({ success: true, id: result.insertId });
    });
  });
});
// PUT /api/casos/:id/notas/:notaId → edita nota propia
app.put('/api/casos/:id/notas/:notaId', (req, res) => {
  const { texto, usuario, tipo_caso, rol, usuario_id } = req.body;
  const tiposCompatibles = obtenerVariantesTipoCaso(tipo_caso);
  const usuarioActual = String(usuario || '').trim();

  if (!texto || !texto.trim()) {
    return res.status(400).json({ success: false, mensaje: 'El texto es obligatorio.' });
  }
  if (!tiposCompatibles.length) {
    return res.status(400).json({ success: false, mensaje: 'tipo_caso es obligatorio.' });
  }
  if (!usuarioActual) {
    return res.status(400).json({ success: false, mensaje: 'No se pudo identificar el propietario de la nota.' });
  }

  verificarAccesoCaso(tipo_caso, req.params.id, rol, usuario_id, (accessErr, permitido) => {
    if (accessErr) return res.status(500).json({ success: false, mensaje: accessErr.message });
    if (!permitido) return res.status(403).json({ success: false, mensaje: 'No tienes acceso a este caso.' });

    const placeholders = tiposCompatibles.map(() => '?').join(', ');
    const sql = `UPDATE notas_caso
                 SET texto = ?
                 WHERE id = ?
                   AND caso_id = ?
                   AND LOWER(tipo_caso) IN (${placeholders})
                   AND LOWER(usuario) = LOWER(?)`;

    db.query(
      sql,
      [texto.trim(), req.params.notaId, req.params.id, ...tiposCompatibles, usuarioActual],
      (err, result) => {
        if (err) return res.status(500).json({ success: false, mensaje: err.message });
        if (!result.affectedRows) {
          return res.status(403).json({
            success: false,
            mensaje: 'Solo el propietario de la nota puede editarla.'
          });
        }
        res.json({ success: true, mensaje: 'Nota actualizada correctamente.' });
      }
    );
  });
});
// DELETE /api/casos/:id/notas/:notaId → elimina nota
app.delete('/api/casos/:id/notas/:notaId', (req, res) => {
  const tiposCompatibles = obtenerVariantesTipoCaso(req.query.tipo_caso);
  if (!tiposCompatibles.length) {
    return res.status(400).json({ success: false, mensaje: 'tipo_caso es obligatorio.' });
  }

  if (!esGestorNotas(req.query.rol)) {
    return res.status(403).json({
      success: false,
      mensaje: 'Solo ADMIN o SECRETARIA pueden eliminar notas.'
    });
  }

  verificarAccesoCaso(req.query.tipo_caso, req.params.id, req.query.rol, req.query.usuario_id, (accessErr, permitido) => {
    if (accessErr) return res.status(500).json({ success: false, mensaje: accessErr.message });
    if (!permitido) return res.status(403).json({ success: false, mensaje: 'No tienes acceso a este caso.' });

    const placeholders = tiposCompatibles.map(() => '?').join(', ');
    const sql = `DELETE FROM notas_caso
                 WHERE id = ? AND caso_id = ? AND LOWER(tipo_caso) IN (${placeholders})`;

    db.query(sql, [req.params.notaId, req.params.id, ...tiposCompatibles], (err, result) => {
      if (err) return res.status(500).json({ success: false, mensaje: err.message });
      if (!result.affectedRows) {
        return res.status(404).json({ success: false, mensaje: 'Nota no encontrada.' });
      }
      res.json({ success: true });
    });
  });
});

app.put('/api/casos/:tipo/:id/asignar', (req, res) => {
  const { tipo, id } = req.params;
  const { abogado_encargado, rol } = req.body;

  if (!esAdmin(rol)) {
    return res.status(403).json({
      success: false,
      mensaje: 'No tienes permisos para asignar.'
    });
  }

  const mapaTablas = {
    amparo: 'amparos',
    amparos: 'amparos',
    administrativo: 'administrativos',
    administrativos: 'administrativos',
    laboral: 'laborales',
    laborales: 'laborales',
    civil: 'civiles',
    civiles: 'civiles',
    mercantil: 'mercantiles',
    mercantiles: 'mercantiles',
    penal: 'penales',
    penales: 'penales',
    agrario: 'agrarios',
    agrarios: 'agrarios',
    varios: 'exp_varios',
    exp_varios: 'exp_varios'
  };

  const tabla = mapaTablas[String(tipo).toLowerCase()];

  if (!tabla) {
    return res.status(400).json({
      success: false,
      mensaje: 'Tipo inválido'
    });
  }

  const sql = `
    UPDATE ${tabla}
    SET abogado_encargado = ?, estado_procesal = ?
    WHERE id = ?
  `;

  db.query(sql, [abogado_encargado, estadoAutomaticoPorAsignacion('', abogado_encargado), id], (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        mensaje: err.message
      });
    }

    res.json({
      success: true,
      mensaje: 'Abogado asignado correctamente'
    });
  });
});

app.put('/api/casos/:tipo/:id/editar', (req, res) => {
  const { tipo, id } = req.params;
  const { prioridad, estado_procesal, abogado_encargado, rol } = req.body;

  if (!esAdmin(rol)) {
    return res.status(403).json({
      success: false,
      mensaje: "No tienes permisos para editar."
    });
  }

  const mapaTablas = {
    amparo: 'amparos',
    amparos: 'amparos',

    administrativo: 'administrativos',
    administrativos: 'administrativos',

    laboral: 'laborales',
    laborales: 'laborales',

    civil: 'civiles',
    civiles: 'civiles',

    mercantil: 'mercantiles',
    mercantiles: 'mercantiles',

    penal: 'penales',
    penales: 'penales',

    agrario: 'agrarios',
    agrarios: 'agrarios',

    varios: 'exp_varios',
    exp_varios: 'exp_varios'
  };

  const tabla = mapaTablas[String(tipo).toLowerCase()];

  if (!tabla) {
    return res.status(400).json({
      success: false,
      mensaje: 'Tipo inválido'
    });
  }

  db.query(
    `SELECT estado_procesal, abogado_colaborador FROM ${tabla} WHERE id = ?`,
    [id],
    (err, rows) => {

      if (err) {
        console.error("Error verificando estado:", err);
        return res.status(500).json({
          success: false,
          mensaje: err.message
        });
      }

      if (!rows.length) {
        return res.status(404).json({
          success: false,
          mensaje: "Caso no encontrado."
        });
      }

      if (String(rows[0].estado_procesal).toLowerCase() === "archivado") {
        return res.status(403).json({
          success: false,
          mensaje: "Este caso está archivado y no se puede editar."
        });
      }

      if (
        tieneAbogadoAsignado(abogado_encargado) &&
        tieneAbogadoAsignado(rows[0].abogado_colaborador) &&
        String(abogado_encargado) === String(rows[0].abogado_colaborador)
      ) {
        return res.status(400).json({
          success: false,
          mensaje: "El abogado principal no puede ser el mismo abogado extra."
        });
      }

      const estadoProcesalFinal = estadoAutomaticoPorAsignacion(estado_procesal, abogado_encargado);
      const sql = `
      UPDATE ${tabla}
      SET prioridad = ?, estado_procesal = ?, abogado_encargado = ?
      WHERE id = ?
    `;

      db.query(
        sql,
        [prioridad, estadoProcesalFinal, abogado_encargado || null, id],
        (err) => {

          if (err) {
            console.error("Error editando:", err);
            return res.status(500).json({
              success: false,
              mensaje: err.message
            });
          }

          res.json({
            success: true,
            mensaje: "Caso actualizado correctamente"
          });
        }
      );
    }
  );
});

app.put('/api/casos/:tipo/:id/reasignar', (req, res) => {
  const { tipo, id } = req.params;
  const { abogado_colaborador, rol } = req.body;

  if (!esAdmin(rol)) {
    return res.status(403).json({
      success: false,
      mensaje: "No tienes permisos para reasignar."
    });
  }

  const tabla = obtenerTablaCaso(tipo);
  if (!tabla) {
    return res.status(400).json({
      success: false,
      mensaje: "Tipo inválido"
    });
  }

  if (!tieneAbogadoAsignado(abogado_colaborador)) {
    return res.status(400).json({
      success: false,
      mensaje: "Selecciona un abogado para reasignar."
    });
  }

  db.query(
    `SELECT estado_procesal, abogado_encargado, abogado_colaborador FROM ${tabla} WHERE id = ?`,
    [id],
    (err, rows) => {
      if (err) {
        console.error("Error verificando caso:", err);
        return res.status(500).json({ success: false, mensaje: err.message });
      }

      if (!rows.length) {
        return res.status(404).json({ success: false, mensaje: "Caso no encontrado." });
      }

      const caso = rows[0];
      if (String(caso.estado_procesal || '').toLowerCase() === "archivado") {
        return res.status(403).json({
          success: false,
          mensaje: "Este caso está archivado y no se puede reasignar."
        });
      }

      if (!tieneAbogadoAsignado(caso.abogado_encargado)) {
        return res.status(400).json({
          success: false,
          mensaje: "Primero asigna un abogado encargado."
        });
      }

      if (tieneAbogadoAsignado(caso.abogado_colaborador)) {
        return res.status(400).json({
          success: false,
          mensaje: "Este caso ya tiene un abogado extra asignado."
        });
      }

      if (String(caso.abogado_encargado) === String(abogado_colaborador)) {
        return res.status(400).json({
          success: false,
          mensaje: "El abogado extra debe ser distinto al encargado."
        });
      }

      db.query(
        `UPDATE ${tabla}
         SET abogado_colaborador = ?, estado_procesal = 'asignado'
         WHERE id = ?`,
        [abogado_colaborador, id],
        updateErr => {
          if (updateErr) {
            console.error("Error reasignando:", updateErr);
            return res.status(500).json({ success: false, mensaje: updateErr.message });
          }

          res.json({
            success: true,
            mensaje: "Abogado extra asignado correctamente"
          });
        }
      );
    }
  );
});

app.put('/api/casos/:tipo/:id/archivar', (req, res) => {
  const { tipo, id } = req.params;
  const { rol } = req.body;

  if (!esAdmin(rol)) {
    return res.status(403).json({
      success: false,
      mensaje: "No tienes permisos para archivar."
    });
  }

  const mapaTablas = {
    amparo: 'amparos',
    amparos: 'amparos',

    administrativo: 'administrativos',
    administrativos: 'administrativos',

    laboral: 'laborales',
    laborales: 'laborales',

    civil: 'civiles',
    civiles: 'civiles',

    mercantil: 'mercantiles',
    mercantiles: 'mercantiles',

    penal: 'penales',
    penales: 'penales',

    agrario: 'agrarios',
    agrarios: 'agrarios',

    varios: 'exp_varios',
    exp_varios: 'exp_varios'
  };

  const tabla = mapaTablas[String(tipo).toLowerCase()];

  if (!tabla) {
    return res.status(400).json({
      success: false,
      mensaje: "Tipo inválido"
    });
  }

  const sql = `
    UPDATE ${tabla}
    SET estado_procesal = 'archivado'
    WHERE id = ?
  `;

  db.query(sql, [id], (err) => {
    if (err) {
      console.error("Error archivando caso:", err);
      return res.status(500).json({
        success: false,
        mensaje: err.message
      });
    };

    res.json({
      success: true,
      mensaje: "Caso archivado correctamente"
    });
  });
});

app.put('/api/casos/:tipo/:id/desarchivar', (req, res) => {
  const { tipo, id } = req.params;
  const { rol } = req.body;

  if (!esAdmin(rol)) {
    return res.status(403).json({
      success: false,
      mensaje: "No tienes permisos para desarchivar."
    });
  }

  const mapaTablas = {
    amparo: 'amparos',
    amparos: 'amparos',

    administrativo: 'administrativos',
    administrativos: 'administrativos',

    laboral: 'laborales',
    laborales: 'laborales',

    civil: 'civiles',
    civiles: 'civiles',

    mercantil: 'mercantiles',
    mercantiles: 'mercantiles',

    penal: 'penales',
    penales: 'penales',

    agrario: 'agrarios',
    agrarios: 'agrarios',

    varios: 'exp_varios',
    exp_varios: 'exp_varios'
  };

  const tabla = mapaTablas[String(tipo).toLowerCase()];

  if (!tabla) {
    return res.status(400).json({
      success: false,
      mensaje: "Tipo inválido"
    });
  }

  const sql = `
    UPDATE ${tabla}
    SET estado_procesal = 'en_proceso'
    WHERE id = ?
  `;

  db.query(sql, [id], (err) => {
    if (err) {
      console.error("Error desarchivando caso:", err);
      return res.status(500).json({
        success: false,
        mensaje: err.message
      });
    }

    res.json({
      success: true,
      mensaje: "Caso desarchivado correctamente"
    });
  });
});

// GET /api/recordatorios → lista según rol
app.get('/api/recordatorios', (req, res) => {
  const usuario_id = String(req.auth?.id || req.query.usuario_id || '');
  const rol = req.auth?.rol || normalizarRol(req.query.rol);
  let sql, params;

  if (rol === 'ADMIN') {
    // Admin ve todos
    sql = `SELECT r.*, 
             u.nombre AS nombre_creador,
             d.nombre AS nombre_destinatario
           FROM recordatorios r
           LEFT JOIN usuarios u ON r.usuario_id = u.id
           LEFT JOIN usuarios d ON r.destinatario_id = d.id
           ORDER BY r.fecha_aviso ASC`;
    params = [];
  } else {
    // Abogado/Secretaria ve los que le mandaron a él
    sql = `SELECT r.*,
             u.nombre AS nombre_creador,
             d.nombre AS nombre_destinatario
           FROM recordatorios r
           LEFT JOIN usuarios u ON r.usuario_id = u.id
           LEFT JOIN usuarios d ON r.destinatario_id = d.id
           WHERE r.destinatario_id = ?
           ORDER BY r.fecha_aviso ASC`;
    params = [usuario_id];
  }

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ success: false, mensaje: err.message });
    res.json({ success: true, recordatorios: results });
  });
});

// GET /api/recordatorios/hoy → toasts del día
app.get('/api/recordatorios/hoy', (req, res) => {
  const usuario_id = String(req.auth?.id || req.query.usuario_id || '');
  const rol = req.auth?.rol || normalizarRol(req.query.rol);
  let sql, params;

  if (rol === 'ADMIN') {
    sql = `SELECT * FROM recordatorios
           WHERE fecha_aviso <= CURDATE() AND visto = FALSE
           ORDER BY fecha_aviso ASC`;
    params = [];
  } else {
    sql = `SELECT * FROM recordatorios
           WHERE fecha_aviso <= CURDATE() AND visto = FALSE 
           AND destinatario_id = ?
           ORDER BY fecha_aviso ASC`;
    params = [usuario_id];
  }

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ success: false, mensaje: err.message });
    res.json({ success: true, recordatorios: results });
  });
});

// POST /api/recordatorios → crear
app.post('/api/recordatorios', (req, res) => {
  const { caso_tipo, caso_id, titulo, descripcion, fecha_aviso, destinatario_id } = req.body;
  const usuario_id = String(req.auth?.id || '');
  const destinatarioFinal = destinatario_id || usuario_id;

  if (!titulo || !fecha_aviso) {
    return res.status(400).json({ success: false, mensaje: "Título y fecha son obligatorios." });
  }

  if (!puedeGestionarCasos(req.auth?.rol) && String(destinatarioFinal) !== usuario_id) {
    return res.status(403).json({ success: false, mensaje: "No puedes crear recordatorios para otros usuarios." });
  }

 db.query(
  `INSERT INTO recordatorios (caso_tipo, caso_id, titulo, descripcion, fecha_aviso, usuario_id, destinatario_id) 
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [caso_tipo || null, caso_id || null, titulo, descripcion || '',
   fecha_aviso, usuario_id || null, destinatarioFinal || null],
  (err, result) => {
    if (err) return res.status(500).json({ success: false, mensaje: err.message });

    // Manda correo al destinatario si tiene email
    if (destinatarioFinal) {
      db.query('SELECT email, nombre FROM usuarios WHERE id = ?',
        [destinatarioFinal], async (err2, rows) => {
          if (!err2 && rows.length && rows[0].email) {
            await enviarCorreo({
              para: rows[0].email,
              asunto: `📌 Nuevo recordatorio: ${titulo}`,
              html: `
                <div style="font-family:sans-serif; max-width:500px; margin:0 auto;">
                  <h2 style="color:#1e40af;">📌 Tienes un nuevo recordatorio</h2>
                  <table style="width:100%; border-collapse:collapse;">
                    <tr>
                      <td style="padding:8px; font-weight:bold;">Título:</td>
                      <td style="padding:8px;">${titulo}</td>
                    </tr>
                    <tr style="background:#f8fafc;">
                      <td style="padding:8px; font-weight:bold;">Fecha de aviso:</td>
                      <td style="padding:8px;">${fecha_aviso}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px; font-weight:bold;">Caso:</td>
                      <td style="padding:8px;">${caso_tipo ? `${caso_tipo.toUpperCase()}-${caso_id}` : '—'}</td>
                    </tr>
                    <tr style="background:#f8fafc;">
                      <td style="padding:8px; font-weight:bold;">Descripción:</td>
                      <td style="padding:8px;">${descripcion || '—'}</td>
                    </tr>
                  </table>
                  <br>
                  <small style="color:#94a3b8;">Sistema Jurídico — Este es un mensaje automático.</small>
                </div>
              `
            });
          }
        }
      );
    }

    res.json({ success: true, mensaje: "¡Recordatorio guardado!", id: result.insertId });
  }
);
});

// PATCH /api/recordatorios/:id/visto
app.patch('/api/recordatorios/:id/visto', (req, res) => {
  const sql = req.auth?.rol === 'ADMIN'
    ? `UPDATE recordatorios SET visto = TRUE WHERE id = ?`
    : `UPDATE recordatorios SET visto = TRUE WHERE id = ? AND destinatario_id = ?`;
  const params = req.auth?.rol === 'ADMIN' ? [req.params.id] : [req.params.id, req.auth?.id];

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json({ success: false, mensaje: err.message });
    if (!result.affectedRows) return res.status(404).json({ success: false, mensaje: 'Recordatorio no encontrado.' });
    res.json({ success: true });
  });
});

// DELETE /api/recordatorios/:id
app.delete('/api/recordatorios/:id', (req, res) => {
  const sql = req.auth?.rol === 'ADMIN'
    ? `DELETE FROM recordatorios WHERE id = ?`
    : `DELETE FROM recordatorios WHERE id = ? AND (usuario_id = ? OR destinatario_id = ?)`;
  const params = req.auth?.rol === 'ADMIN' ? [req.params.id] : [req.params.id, req.auth?.id, req.auth?.id];

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json({ success: false, mensaje: err.message });
    if (!result.affectedRows) return res.status(404).json({ success: false, mensaje: 'Recordatorio no encontrado.' });
    res.json({ success: true });
  });
});

// GET /api/recordatorios/automaticos → casos que vencen hoy
app.get('/api/recordatorios/automaticos', (req, res) => {
  const usuario_id = String(req.auth?.id || req.query.usuario_id || '');
  const rol = req.auth?.rol || normalizarRol(req.query.rol);

  // Consulta todas las tablas buscando fecha = hoy
  const tablas = [
    { tabla: 'amparos', campoFecha: 'fecha_emplazamiento' },
    { tabla: 'administrativos', campoFecha: 'fecha_emplazamiento' },
    { tabla: 'laborales', campoFecha: 'emplazamiento' },
    { tabla: 'civiles', campoFecha: 'fecha_inicio' },
    { tabla: 'mercantiles', campoFecha: 'fecha' },
    { tabla: 'agrarios', campoFecha: 'fecha_emplazamiento' },
    { tabla: 'exp_varios', campoFecha: 'fecha_recibido' }
  ];

  // Construye un UNION de todas las tablas
  const unionSQL = `
  SELECT 'amparos' AS caso_tipo, id, expediente, asunto, 
         fecha_emplazamiento AS fecha, abogado_encargado
  FROM amparos
  WHERE DATE(fecha_emplazamiento) = CURDATE()
  AND (estado_procesal IS NULL OR estado_procesal != 'archivado')

  UNION ALL

  SELECT 'administrativos', id, expediente, asunto,
         fecha_emplazamiento, NULL
  FROM administrativos
  WHERE DATE(fecha_emplazamiento) = CURDATE()
  AND (estado_procesal IS NULL OR estado_procesal != 'archivado')

  UNION ALL

  SELECT 'laborales', id, expediente, actor,
         emplazamiento, NULL
  FROM laborales
  WHERE DATE(emplazamiento) = CURDATE()
  AND (estado_procesal IS NULL OR estado_procesal != 'archivado')

  UNION ALL

  SELECT 'civiles', id, expediente, asunto,
         fecha_inicio, NULL
  FROM civiles
  WHERE DATE(fecha_inicio) = CURDATE()
  AND (estado_procesal IS NULL OR estado_procesal != 'archivado')

  UNION ALL

  SELECT 'mercantiles', id, expediente, asunto,
         fecha, NULL
  FROM mercantiles
  WHERE DATE(fecha) = CURDATE()
  AND (estado_procesal IS NULL OR estado_procesal != 'archivado')

  UNION ALL

  SELECT 'penales', id, expediente, asunto,
         NULL, NULL
  FROM penales
  WHERE (estado_procesal IS NULL OR estado_procesal != 'archivado')

  UNION ALL

  SELECT 'agrarios', id, expediente, asunto,
         fecha_emplazamiento, NULL
  FROM agrarios
  WHERE DATE(fecha_emplazamiento) = CURDATE()
  AND (estado_procesal IS NULL OR estado_procesal != 'archivado')

  UNION ALL

  SELECT 'exp_varios', id, expediente, asunto,
         fecha_recibido, NULL
  FROM exp_varios
  WHERE DATE(fecha_recibido) = CURDATE()
  AND (estado_procesal IS NULL OR estado_procesal != 'archivado')
`;

  db.query(unionSQL, (err, results) => {
    if (err) return res.status(500).json({ success: false, mensaje: err.message });

    // Si es abogado, filtra solo sus casos
    // abogado_encargado guarda el username en tu BD
    let casos = results;
    if (rol !== 'ADMIN' && rol !== 'SECRETARIA') {
      console.log("Filtrando por usuario_id:", usuario_id);
      console.log("Casos antes del filtro:", results.map(c => ({ tipo: c.caso_tipo, id: c.id, abogado: c.abogado_encargado })));

      casos = results.filter(c =>
        c.abogado_encargado != null &&
        String(c.abogado_encargado).trim() === String(usuario_id).trim()
      );

      console.log("Casos después del filtro:", casos.length);
    }
    res.json({ success: true, casos });
  });
});
