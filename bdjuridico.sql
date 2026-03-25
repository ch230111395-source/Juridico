
CREATE DATABASE IF NOT EXISTS juridico;
USE juridico;


CREATE TABLE estado_caso (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  clave VARCHAR(50) UNIQUE,
  nombre VARCHAR(100)
);

INSERT IGNORE INTO estado_caso (clave, nombre) VALUES
('EN_PROCESO','En proceso'),
('SIN_ASIGNAR','Sin asignar'),
('ASIGNADO','Asignado'),
('FINALIZADO','Finalizado'),
('SIN_ACTIVIDAD','Sin actividad');

CREATE TABLE amparos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    no INT,
    expediente TEXT,
    fecha_emplazamiento TEXT,
    juzgado TEXT,
    actor TEXT,
    demandado TEXT,
    asunto TEXT,
    estado_procesal TEXT,
    abogado_encargado TEXT,
    amparos TEXT,
    estado_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (estado_id) REFERENCES estado_caso(id)
);

CREATE TABLE administrativos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    numero INT,
    expediente TEXT,
    fecha_emplazamiento TEXT,
    sala TEXT,
    actor TEXT,
    autoridad_demandada_demandado TEXT,
    amparos TEXT,
    asunto TEXT,
    estado_procesal TEXT,
    estado_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (estado_id) REFERENCES estado_caso(id)
);

CREATE TABLE laborales (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    numero INT,
    expediente TEXT,
    mesa TEXT,
    administracion TEXT,
    actor TEXT,
    nombramiento TEXT,
    area_departamento TEXT,
    emplazamiento TEXT,
    amparos TEXT,
    estado_procesal TEXT,
    salario TEXT,
    estado_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (estado_id) REFERENCES estado_caso(id)
);

CREATE TABLE civiles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    no INT,
    expediente TEXT,
    fecha_inicio TEXT,
    juzgado TEXT,
    actor TEXT,
    demandado TEXT,
    asunto TEXT,
    estado_procesal TEXT,
    amparos TEXT,
    estado_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (estado_id) REFERENCES estado_caso(id)
);

CREATE TABLE mercantiles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    no INT,
    expediente TEXT,
    fecha TEXT,
    juzgado TEXT,
    actor TEXT,
    asunto TEXT,
    estado_procesal TEXT,
    estado_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (estado_id) REFERENCES estado_caso(id)
);

CREATE TABLE penales (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    numero INT,
    expediente TEXT,
    ano INT,
    juzgado TEXT,
    actor TEXT,
    demandado TEXT,
    asunto TEXT,
    estado_procesal TEXT,
    estado_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (estado_id) REFERENCES estado_caso(id)
);

CREATE TABLE agrarios (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    numero INT,
    expediente TEXT,
    fecha_emplazamiento TEXT,
    juzgado TEXT,
    actor TEXT,
    asunto TEXT,
    estado_procesal TEXT,
    amparos TEXT,
    estado_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (estado_id) REFERENCES estado_caso(id)
);

CREATE TABLE exp_varios (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    numero INT,
    no INT,
    expediente TEXT,
    fecha_recibido TEXT,
    juzgado TEXT,
    actor TEXT,
    demandado TEXT,
    asunto TEXT,
    estado_procesal TEXT,
    estado_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (estado_id) REFERENCES estado_caso(id)
);

-- =====================
-- ÍNDICES
-- =====================
CREATE INDEX idx_amparos_expediente ON amparos (expediente(100));
CREATE INDEX idx_amparos_actor ON amparos (actor(100));

CREATE INDEX idx_administrativos_expediente ON administrativos (expediente(100));
CREATE INDEX idx_administrativos_actor ON administrativos (actor(100));

CREATE INDEX idx_laborales_expediente ON laborales (expediente(100));
CREATE INDEX idx_laborales_actor ON laborales (actor(100));

CREATE INDEX idx_civiles_expediente ON civiles (expediente(100));
CREATE INDEX idx_civiles_actor ON civiles (actor(100));

CREATE INDEX idx_mercantiles_expediente ON mercantiles (expediente(100));
CREATE INDEX idx_mercantiles_actor ON mercantiles (actor(100));

CREATE INDEX idx_penales_expediente ON penales (expediente(100));
CREATE INDEX idx_penales_actor ON penales (actor(100));

CREATE INDEX idx_agrarios_expediente ON agrarios (expediente(100));
CREATE INDEX idx_agrarios_actor ON agrarios (actor(100));

CREATE INDEX idx_exp_varios_expediente ON exp_varios (expediente(100));
CREATE INDEX idx_exp_varios_actor ON exp_varios (actor(100));


CREATE TABLE usuarios (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  nombre VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  rol ENUM('ADMIN','SECRETARIA','ABOGADO') DEFAULT 'ABOGADO',
  password_hash TEXT NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usuarios_rol ON usuarios (rol);
CREATE INDEX idx_usuarios_activo ON usuarios (activo);


INSERT IGNORE INTO usuarios (username, nombre, email, rol, password_hash)
VALUES
('admin','Administrador','admin@local','ADMIN', SHA2('Admin123!',256)),
('secretaria','Secretaria','secretaria@local','SECRETARIA', SHA2('Secre123!',256)),
('usuario1','Usuario 1','usuario1@local','USUARIO', SHA2('User123!',256));

-- =========================
-- Compañeros la parte de los TRIGGER queda 
-- pendiente para no tener problemas al momento de hacer pruebas
-- =========================

DELIMITER $$
-- =========================
-- TRIGGER: SOLO 1 ADMIN (INSERT)
-- =========================
CREATE TRIGGER validar_un_admin_insert
BEFORE INSERT ON usuarios
FOR EACH ROW
BEGIN
    IF NEW.rol = 'ADMIN' THEN
        IF (SELECT COUNT(*) FROM usuarios WHERE rol = 'ADMIN') > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Ya existe un ADMIN';
        END IF;
    END IF;
END$$

-- =========================
-- TRIGGER: SOLO 1 ADMIN (UPDATE)
-- =========================
CREATE TRIGGER validar_un_admin_update
BEFORE UPDATE ON usuarios
FOR EACH ROW
BEGIN
    IF NEW.rol = 'ADMIN' THEN
        IF (SELECT COUNT(*) FROM usuarios WHERE rol = 'ADMIN' AND id != OLD.id) > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Ya existe un ADMIN';
        END IF;
    END IF;
END$$

-- =========================
-- TRIGGER: SOLO 1 SECRETARIA (INSERT)
-- =========================
CREATE TRIGGER validar_una_secretaria_insert
BEFORE INSERT ON usuarios
FOR EACH ROW
BEGIN
    IF NEW.rol = 'SECRETARIA' THEN
        IF (SELECT COUNT(*) FROM usuarios WHERE rol = 'SECRETARIA') > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Ya existe una SECRETARIA';
        END IF;
    END IF;
END$$

-- =========================
-- TRIGGER: SOLO 1 SECRETARIA (UPDATE)
-- =========================
CREATE TRIGGER validar_una_secretaria_update
BEFORE UPDATE ON usuarios
FOR EACH ROW
BEGIN
    IF NEW.rol = 'SECRETARIA' THEN
        IF (SELECT COUNT(*) FROM usuarios WHERE rol = 'SECRETARIA' AND id != OLD.id) > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Ya existe una SECRETARIA';
        END IF;
    END IF;
END$$

DELIMITER ;

CREATE VIEW v_expedientes AS
SELECT 'amparos' AS tipo, id, no AS numero, expediente, fecha_emplazamiento AS fecha, juzgado, actor, demandado, asunto, estado_procesal, amparos, created_at FROM amparos
UNION ALL
SELECT 'administrativos', id, numero, expediente, fecha_emplazamiento, sala, actor, autoridad_demandada_demandado, asunto, estado_procesal, amparos, created_at FROM administrativos
UNION ALL
SELECT 'laborales', id, numero, expediente, emplazamiento, mesa, actor, NULL, NULL, estado_procesal, amparos, created_at FROM laborales
UNION ALL
SELECT 'civiles', id, no, expediente, fecha_inicio, juzgado, actor, demandado, asunto, estado_procesal, amparos, created_at FROM civiles
UNION ALL
SELECT 'mercantiles', id, no, expediente, fecha, juzgado, actor, NULL, asunto, estado_procesal, NULL, created_at FROM mercantiles
UNION ALL
SELECT 'penales', id, numero, expediente, NULL, juzgado, actor, demandado, asunto, estado_procesal, NULL, created_at FROM penales
UNION ALL
SELECT 'agrarios', id, numero, expediente, fecha_emplazamiento, juzgado, actor, NULL, asunto, estado_procesal, amparos, created_at FROM agrarios
UNION ALL
SELECT 'exp_varios', id, numero, expediente, fecha_recibido, juzgado, actor, demandado, asunto, estado_procesal, NULL, created_at FROM exp_varios;