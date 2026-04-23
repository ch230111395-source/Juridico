const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

function normalizarTipoCaso(tipo) {
  const limpio = String(tipo || '').trim().toLowerCase();
  if (!limpio) return '';

  for (const [canonico, alias] of Object.entries(CASE_TYPE_ALIASES)) {
    if (alias.includes(limpio)) return canonico;
  }

  return '';
}

function obtenerVariantesTipoCaso(tipo) {
  const canonico = normalizarTipoCaso(tipo);
  if (!canonico) return [];
  return [...new Set((CASE_TYPE_ALIASES[canonico] || [canonico]).map(valor => valor.toLowerCase()))];
}


db.connect(err => {
  if (err) {
    console.error('Error conectando a la base de datos:', err);
    return;
  }
  console.log('¡Conectado exitosamente a MySQL!');
});


app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;

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

      if (rolesPermitidos.includes(usuarioEncontrado.rol)) {
        return res.json({
          success: true,
          mensaje: "¡Bienvenido!",
          usuario: {
            id: usuarioEncontrado.id,
            username: usuarioEncontrado.username,
            rol: usuarioEncontrado.rol
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

// Agregar casos
// Ruta para agregar un nuevo caso
app.post('/api/nuevocaso', (req, res) => {
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

  // Mapeo exacto según tu bdjuridico.sql
  // ----------------- Modificacion echa por Fer el 18 -------------------------
  switch (tipo) {
    case 'amparo':
      sql = `INSERT INTO amparos 
      (expediente, fecha_emplazamiento, estado_procesal, asunto, juzgado, actor, demandado, abogado_encargado, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, fecha_emplazamiento, estado_procesal, asunto, juzgado, actor, demandado, abogado_encargado, prioridad];
      break;

    case 'administrativo':
      sql = `INSERT INTO administrativos 
      (expediente, estado_procesal, asunto, fecha_emplazamiento, sala, actor, abogado_encargado, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, estado_procesal, asunto, fecha_emplazamiento, sala, actor, abogado_encargado, prioridad];
      break;

    case 'laboral':
      sql = `INSERT INTO laborales 
      (expediente, estado_procesal, actor, emplazamiento, mesa, numero, abogado_encargado, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, estado_procesal, actor, fecha_emplazamiento, mesa, numero, abogado_encargado, prioridad];
      break;

    case 'civil':
      sql = `INSERT INTO civiles 
      (expediente, estado_procesal, asunto, fecha_inicio, juzgado, actor, demandado, abogado_encargado, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, estado_procesal, asunto, fecha_emplazamiento, juzgado, actor, demandado, abogado_encargado, prioridad];
      break;

    case 'mercantil':
      sql = `INSERT INTO mercantiles 
      (expediente, estado_procesal, asunto, fecha, juzgado, actor, abogado_encargado, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, estado_procesal, asunto, fecha_emplazamiento, juzgado, actor, abogado_encargado, prioridad];
      break;

    case 'penal':
      // ⚠️ penales NO tiene fecha_emplazamiento en tu schema
      sql = `INSERT INTO penales 
     (expediente, estado_procesal, asunto, juzgado, actor, demandado, abogado_encargado, prioridad, estado_id) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`;

      params = [expediente, estado_procesal, asunto, juzgado, actor, demandado, abogado_encargado, prioridad];
      break;

    case 'agrario':
      // ⚠️ agrarios NO tiene demandado en tu schema
      sql = `INSERT INTO agrarios 
      (expediente, estado_procesal, asunto, fecha_emplazamiento, actor, abogado_encargado, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, estado_procesal, asunto, fecha_emplazamiento, actor, abogado_encargado, prioridad];
      break;

    case 'varios':
      sql = `INSERT INTO exp_varios 
      (expediente, estado_procesal, asunto, fecha_recibido,abogado_encargado, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, estado_procesal, asunto, fecha_emplazamiento, abogado_encargado, prioridad];
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
  const busqueda     = (req.query.busqueda || "").trim();

  let sql    = "SELECT * FROM v_expedientes";
  let params = [];
  const condiciones = [];

  const mapaTipos = {
    "Amparo": "amparos", "amparo": "amparos",
    "Administrativo": "administrativos", "administrativo": "administrativos",
    "Laboral": "laborales", "laboral": "laborales",
    "Civil": "civiles", "civil": "civiles",
    "Mercantil": "mercantiles", "mercantil": "mercantiles",
    "Penal": "penales", "penal": "penales",
    "Agrario": "agrarios", "agrario": "agrarios",
    "Varios": "exp_varios", "varios": "exp_varios"
  };

  // Filtro por tipo
  if (tipoRecibido && tipoRecibido !== "Todos") {
    const tipoBD = mapaTipos[tipoRecibido];
    if (!tipoBD) {
      return res.status(400).json({ success: false, mensaje: "Tipo no válido" });
    }
    condiciones.push("tipo = CONVERT(? USING utf8mb4) COLLATE utf8mb4_0900_ai_ci");
    params.push(tipoBD);
  }

  // Filtro por búsqueda: busca en expediente, actor, demandado y asunto
  if (busqueda) {
    condiciones.push(
      "(expediente LIKE ? OR actor LIKE ? OR demandado LIKE ? OR asunto LIKE ?)"
    );
    const termino = `%${busqueda}%`;
    params.push(termino, termino, termino, termino);
  }

  if (condiciones.length > 0) {
    sql += " WHERE " + condiciones.join(" AND ");
  }

  const limite = parseInt(req.query.limite) || 5;
  const pagina = parseInt(req.query.pagina) || 1;
  const offset = (pagina - 1) * limite;
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
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
      nombre: caso.asunto || caso.actor || caso.expediente || "Sin nombre",
      tipo: caso.tipo,
      tipo_db: normalizarTipoCaso(caso.tipo) || caso.tipo,
      prioridad: caso.prioridad || "Media",
      estado: caso.estado_procesal || "—",
      asignado: caso.nombre_abogado || "Sin asignar"
  }));

    res.json({
      success: true,
      casos,
      pagina,
      limite
    });
  });
});

// GET /api/usuarios → lista de usuarios
app.get('/api/usuarios', (req, res) => {
  const sql = `SELECT id, nombre, rol, email, activo FROM usuarios ORDER BY id ASC`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, mensaje: err.message });
    res.json({ success: true, usuarios: results });
  });
});

app.post('/api/usuarios', (req, res) => {
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
//-----------------PRUEBA-------------------------

// ─────────────────────────────────────────
// ENDPOINTS DE DOCUMENTOS
// ─────────────────────────────────────────

// GET  /api/documentos/:casoId  → lista
app.get('/api/documentos/:casoId', (req, res) => {
  const tipoCaso = normalizarTipoCaso(req.query.tipo_caso);
  if (!tipoCaso) {
    return res.status(400).json({ success: false, mensaje: 'tipo_caso es obligatorio.' });
  }

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

// POST /api/documentos/:casoId  → sube archivo
app.post('/api/documentos/:casoId', upload.single('archivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, mensaje: 'Sin archivo' });
  const tipoCaso = normalizarTipoCaso(req.body.tipo_caso);
  if (!tipoCaso) {
    return res.status(400).json({ success: false, mensaje: 'tipo_caso es obligatorio.' });
  }

  const sql = `INSERT INTO documentos
               (caso_id, tipo_caso, nombre_original, nombre_archivo, mimetype, tamaño, subido_por)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql,
    [req.params.casoId, tipoCaso, req.file.originalname, req.file.filename,
     req.file.mimetype, req.file.size, req.body.subido_por || 'Sistema'],
    (err, r) => {
      if (err) return res.status(500).json({ success: false, mensaje: err.message });
      res.json({ success: true, id: r.insertId });
    }
  );
});

// GET  /api/documentos/descargar/:docId  → descarga
app.get('/api/documentos/descargar/:docId', (req, res) => {
  db.query('SELECT nombre_original, nombre_archivo FROM documentos WHERE id = ?',
    [req.params.docId], (err, rows) => {
      if (err || !rows.length)
        return res.status(404).json({ success: false, mensaje: 'No encontrado' });
      const ruta = path.join(__dirname, 'uploads', rows[0].nombre_archivo);
      if (!fs.existsSync(ruta))
        return res.status(404).json({ success: false, mensaje: 'Archivo eliminado del servidor' });
      res.download(ruta, rows[0].nombre_original);
    });
});

// DELETE /api/documentos/:docId  → elimina
app.delete('/api/documentos/:docId', (req, res) => {
  db.query('SELECT nombre_archivo FROM documentos WHERE id = ?',
    [req.params.docId], (err, rows) => {
      if (err || !rows.length)
        return res.status(404).json({ success: false, mensaje: 'No encontrado' });

      // Borrar del disco
      const ruta = path.join(__dirname, 'uploads', rows[0].nombre_archivo);
      if (fs.existsSync(ruta)) fs.unlinkSync(ruta);

      // Borrar de la BD
      db.query('DELETE FROM documentos WHERE id = ?', [req.params.docId], err2 => {
        if (err2) return res.status(500).json({ success: false, mensaje: err2.message });
        res.json({ success: true });
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

// POST /api/casos/:id/notas → guardar nota
app.post('/api/casos/:id/notas', (req, res) => {
  const { texto, usuario, tipo_caso } = req.body;
  const tipoCaso = normalizarTipoCaso(tipo_caso);
  if (!texto || !texto.trim()) {
    return res.status(400).json({ success: false, mensaje: 'El texto es obligatorio.' });
  }
  if (!tipoCaso) {
    return res.status(400).json({ success: false, mensaje: 'tipo_caso es obligatorio.' });
  }

  const sql = `INSERT INTO notas_caso (caso_id, tipo_caso, texto, usuario) VALUES (?, ?, ?, ?)`;
  db.query(sql, [req.params.id, tipoCaso, texto.trim(), usuario || 'Sistema'], (err, result) => {
    if (err) return res.status(500).json({ success: false, mensaje: err.message });
    res.json({ success: true, id: result.insertId });
  });
});

// DELETE /api/casos/:id/notas/:notaId → elimina nota
app.delete('/api/casos/:id/notas/:notaId', (req, res) => {
  const tiposCompatibles = obtenerVariantesTipoCaso(req.query.tipo_caso);
  if (!tiposCompatibles.length) {
    return res.status(400).json({ success: false, mensaje: 'tipo_caso es obligatorio.' });
  }

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

app.put('/api/casos/:tipo/:id/asignar', (req, res) => {
  const { tipo, id } = req.params;
  const { abogado_encargado } = req.body;

  const mapaTablas = {
    amparo: 'amparos',
    administrativo: 'administrativos',
    laboral: 'laborales',
    civil: 'civiles',
    mercantil: 'mercantiles',
    penal: 'penales',
    agrario: 'agrarios',
    varios: 'exp_varios'
  };

  const tabla = mapaTablas[tipo];

  if (!tabla) {
    return res.status(400).json({
      success: false,
      mensaje: 'Tipo inválido'
    });
  }

  const sql = `
    UPDATE ${tabla}
    SET abogado_encargado = ?
    WHERE id = ?
  `;

  db.query(sql, [abogado_encargado, id], (err, result) => {
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


const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor Backend corriendo y escuchando en http://localhost:${PORT}`);
});
