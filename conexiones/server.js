const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();


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
  console.log(req);
  const { 
    tipo_caso, expediente, estado_procesal, asunto, 
    abogado_encargado, fecha_emplazamiento, juzgado, 
    actor, demandado, sala, mesa, numero 
  } = req.body;

  let sql = "";
  let params = [];
  const tipo = tipo_caso ? tipo_caso.toLowerCase() : '';

  // Mapeo exacto según tu bdjuridico.sql
  switch (tipo) {
  case 'amparo':
    sql = `INSERT INTO amparos 
      (expediente, estado_procesal, asunto, fecha_emplazamiento, abogado_encargado, actor, demandado, juzgado, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`;
    params = [expediente, estado_procesal, asunto, fecha_emplazamiento, abogado_encargado, actor, demandado, juzgado];
    break;

  case 'administrativo':
    sql = `INSERT INTO administrativos 
      (expediente, estado_procesal, asunto, fecha_emplazamiento, sala, actor, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, 1)`;
    params = [expediente, estado_procesal, asunto, fecha_emplazamiento, sala, actor];
    break;

  case 'laboral':
    sql = `INSERT INTO laborales 
      (expediente, estado_procesal, actor, emplazamiento, mesa, numero, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, 1)`;
    params = [expediente, estado_procesal, actor, fecha_emplazamiento, mesa, numero];
    break;

  case 'civil':
    sql = `INSERT INTO civiles 
      (expediente, estado_procesal, asunto, fecha_inicio, juzgado, actor, demandado, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)`;
    params = [expediente, estado_procesal, asunto, fecha_emplazamiento, juzgado, actor, demandado];
    break;

  case 'mercantil':
    sql = `INSERT INTO mercantiles 
      (expediente, estado_procesal, asunto, fecha, juzgado, actor, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, 1)`;
    params = [expediente, estado_procesal, asunto, fecha_emplazamiento, juzgado, actor];
    break;

  case 'penal':
    // ⚠️ penales NO tiene fecha_emplazamiento en tu schema
    sql = `INSERT INTO penales 
      (expediente, estado_procesal, asunto, juzgado, actor, demandado, estado_id) 
      VALUES (?, ?, ?, ?, ?, ?, 1)`;
    params = [expediente, estado_procesal, asunto, juzgado, actor, demandado];
    break;

  case 'agrario':
    // ⚠️ agrarios NO tiene demandado en tu schema
    sql = `INSERT INTO agrarios 
      (expediente, estado_procesal, asunto, fecha_emplazamiento, actor, estado_id) 
      VALUES (?, ?, ?, ?, ?, 1)`;
    params = [expediente, estado_procesal, asunto, fecha_emplazamiento, actor];
    break;

  case 'varios':
    sql = `INSERT INTO exp_varios 
      (expediente, estado_procesal, asunto, fecha_recibido, estado_id) 
      VALUES (?, ?, ?, ?, 1)`;
    params = [expediente, estado_procesal, asunto, fecha_emplazamiento];
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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor Backend corriendo y escuchando en http://localhost:${PORT}`);
});