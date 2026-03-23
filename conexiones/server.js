const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

app.use(cors()); 
app.use(express.json());


const db = mysql.createConnection({
    host: '   ',
    user: '   ',     
    password: '   ', 
    database: '   '     
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


    const sql = "SELECT * FROM usuarios WHERE nombre_usuario = ? AND contraseña = ?";
    
    db.query(sql, [usuario, password], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Error interno del servidor" });
        }

    
        if (results.length > 0) {
            const usuarioEncontrado = results[0];
            

            if(usuarioEncontrado.rol === 'admin') {
                res.json({ success: true, mensaje: "¡Bienvenido Administrador!" });
            } else {
                res.status(403).json({ success: false, mensaje: "Acceso denegado. Solo administradores." });
            }

        } else {
            
            res.status(401).json({ success: false, mensaje: "Usuario o contraseña incorrectos" });
        }
    });
});


const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor Backend corriendo y escuchando en http://localhost:${PORT}`);
});