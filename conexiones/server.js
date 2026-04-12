const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();


const app = express();
app.use(cors());
app.use(express.json());


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

      if (usuarioEncontrado.rol === 'ADMIN' || usuarioEncontrado.rol === 'ABOGADO' || usuarioEncontrado.rol === 'SECRETARIA') {
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


const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor Backend corriendo y escuchando en http://localhost:${PORT}`);
});