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
  console.log("BODY:", req.body);
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
      (expediente, estado_procesal, asunto, juzgado, actor, demandado, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, estado_procesal, asunto, juzgado, actor, demandado, prioridad];
      break;

    case 'administrativo':
      sql = `INSERT INTO administrativos 
      (expediente, estado_procesal, asunto, fecha_emplazamiento, sala, actor, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, estado_procesal, asunto, fecha_emplazamiento, sala, actor, prioridad];
      break;

    case 'laboral':
      sql = `INSERT INTO laborales 
      (expediente, estado_procesal, actor, emplazamiento, mesa, numero,prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, estado_procesal, actor, fecha_emplazamiento, mesa, numero, prioridad];
      break;

    case 'civil':
      sql = `INSERT INTO civiles 
      (expediente, estado_procesal, asunto, fecha_inicio, juzgado, actor, demandado, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, estado_procesal, asunto, fecha_emplazamiento, juzgado, actor, demandado, prioridad];
      break;

    case 'mercantil':
      sql = `INSERT INTO mercantiles 
      (expediente, estado_procesal, asunto, fecha, juzgado, actor,prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, estado_procesal, asunto, fecha_emplazamiento, juzgado, actor, prioridad];
      break;

    case 'penal':
      // ⚠️ penales NO tiene fecha_emplazamiento en tu schema
      sql = `INSERT INTO penales 
     (expediente, estado_procesal, asunto, juzgado, actor, demandado, prioridad, estado_id) 
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)`;

      params = [expediente, estado_procesal, asunto, juzgado, actor, demandado, prioridad];
      break;

    case 'agrario':
      // ⚠️ agrarios NO tiene demandado en tu schema
      sql = `INSERT INTO agrarios 
      (expediente, estado_procesal, asunto, fecha_emplazamiento, actor, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, 1)`;
      params = [expediente, estado_procesal, asunto, fecha_emplazamiento, actor, prioridad];
      break;

    case 'varios':
      sql = `INSERT INTO exp_varios 
      (expediente, estado_procesal, asunto, fecha_recibido, prioridad, estado_id) 
      VALUES (?, ?, ?, ?, ?, 1)`;
      params = [expediente, estado_procesal, asunto, fecha_emplazamiento, prioridad];
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

  let sql = "SELECT * FROM v_expedientes";
  let params = [];

  const mapaTipos = {
    "Amparo": "amparos",
    "Administrativo": "administrativos",
    "Laboral": "laborales",
    "Civil": "civiles",
    "Mercantil": "mercantiles",
    "Penal": "penales",
    "Agrario": "agrarios",
    "Varios": "exp_varios",


    "amparo": "amparos",
    "administrativo": "administrativos",
    "laboral": "laborales",
    "civil": "civiles",
    "mercantil": "mercantiles",
    "penal": "penales",
    "agrario": "agrarios",
    "varios": "exp_varios"
  };

  if (tipoRecibido && tipoRecibido !== "Todos") {
    const tipoBD = mapaTipos[tipoRecibido];

    if (!tipoBD) {
      return res.status(400).json({
        success: false,
        mensaje: "Tipo no válido"
      });
    }
    //-----------------PRUEBA-------------------------
    sql += " WHERE tipo = CONVERT(? USING utf8mb4) COLLATE utf8mb4_0900_ai_ci";
    //-----------------PRUEBA-------------------------
    params.push(tipoBD);
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
      prioridad: caso.prioridad || "Media",
      estado: caso.estado_procesal || "—",
      asignado: "Sin asignar"
    }));

    res.json({
      success: true,
      casos,
      pagina,
      limite
    });
  });
});
//-----------------PRUEBA-------------------------

// ─────────────────────────────────────────
// ENDPOINTS DE DOCUMENTOS
// ─────────────────────────────────────────

// GET  /api/documentos/:casoId  → lista
app.get('/api/documentos/:casoId', (req, res) => {
  const sql = `SELECT id, nombre_original, tamaño, subido_por,
                      DATE_FORMAT(created_at,'%d/%m/%Y %H:%i') AS fecha
               FROM documentos WHERE caso_id = ? ORDER BY created_at DESC`;
  db.query(sql, [req.params.casoId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, mensaje: err.message });
    res.json({ success: true, documentos: rows });
  });
});

// POST /api/documentos/:casoId  → sube archivo
app.post('/api/documentos/:casoId', upload.single('archivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, mensaje: 'Sin archivo' });
  const sql = `INSERT INTO documentos
               (caso_id, nombre_original, nombre_archivo, mimetype, tamaño, subido_por)
               VALUES (?, ?, ?, ?, ?, ?)`;
  db.query(sql,
    [req.params.casoId, req.file.originalname, req.file.filename,
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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor Backend corriendo y escuchando en http://localhost:${PORT}`);
});