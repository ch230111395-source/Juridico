
SELECT current_database();
CREATE SCHEMA IF NOT EXISTS juridico;

SET search_path TO juridico, public;

CREATE TABLE IF NOT EXISTS juridico.amparos (
    id BIGSERIAL PRIMARY KEY,
    no INTEGER,
    expediente TEXT,
    fecha_emplazamiento TEXT,
    juzgado TEXT,
    actor TEXT,
    demandado TEXT,
    asunto TEXT,
    estado_procesal TEXT,
    abogado_encargado TEXT,
    amparos TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amparos_expediente ON juridico.amparos (expediente);
CREATE INDEX IF NOT EXISTS idx_amparos_actor ON juridico.amparos (actor);

CREATE TABLE IF NOT EXISTS juridico.administrativos (
    id BIGSERIAL PRIMARY KEY,
    numero INTEGER,
    expediente TEXT,
    fecha_emplazamiento TEXT,
    sala TEXT,
    actor TEXT,
    autoridad_demandada_demandado TEXT,
    amparos TEXT,
    asunto TEXT,
    estado_procesal TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_administrativos_expediente ON juridico.administrativos (expediente);
CREATE INDEX IF NOT EXISTS idx_administrativos_actor ON juridico.administrativos (actor);

CREATE TABLE IF NOT EXISTS juridico.laborales (
    id BIGSERIAL PRIMARY KEY,
    numero INTEGER,
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_laborales_expediente ON juridico.laborales (expediente);
CREATE INDEX IF NOT EXISTS idx_laborales_actor ON juridico.laborales (actor);

CREATE TABLE IF NOT EXISTS juridico.civiles (
    id BIGSERIAL PRIMARY KEY,
    no INTEGER,
    expediente TEXT,
    fecha_inicio TEXT,
    juzgado TEXT,
    actor TEXT,
    demandado TEXT,
    asunto TEXT,
    estado_procesal TEXT,
    amparos TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_civiles_expediente ON juridico.civiles (expediente);
CREATE INDEX IF NOT EXISTS idx_civiles_actor ON juridico.civiles (actor);

CREATE TABLE IF NOT EXISTS juridico.mercantiles (
    id BIGSERIAL PRIMARY KEY,
    no INTEGER,
    expediente TEXT,
    fecha TEXT,
    juzgado TEXT,
    actor TEXT,
    asunto TEXT,
    estado_procesal TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mercantiles_expediente ON juridico.mercantiles (expediente);
CREATE INDEX IF NOT EXISTS idx_mercantiles_actor ON juridico.mercantiles (actor);

CREATE TABLE IF NOT EXISTS juridico.penales (
    id BIGSERIAL PRIMARY KEY,
    numero INTEGER,
    expediente TEXT,
    ano INTEGER,
    juzgado TEXT,
    actor TEXT,
    demandado TEXT,
    asunto TEXT,
    estado_procesal TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_penales_expediente ON juridico.penales (expediente);
CREATE INDEX IF NOT EXISTS idx_penales_actor ON juridico.penales (actor);

CREATE TABLE IF NOT EXISTS juridico.agrarios (
    id BIGSERIAL PRIMARY KEY,
    numero INTEGER,
    expediente TEXT,
    fecha_emplazamiento TEXT,
    juzgado TEXT,
    actor TEXT,
    asunto TEXT,
    estado_procesal TEXT,
    amparos TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agrarios_expediente ON juridico.agrarios (expediente);
CREATE INDEX IF NOT EXISTS idx_agrarios_actor ON juridico.agrarios (actor);

CREATE TABLE IF NOT EXISTS juridico.exp_varios (
    id BIGSERIAL PRIMARY KEY,
    numero INTEGER,
    no INTEGER,
    expediente TEXT,
    fecha_recibido TEXT,
    juzgado TEXT,
    actor TEXT,
    demandado TEXT,
    asunto TEXT,
    estado_procesal TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'rol_usuario' AND n.nspname = 'juridico'
  ) THEN
    CREATE TYPE juridico.rol_usuario AS ENUM ('ADMIN', 'SECRETARIA', 'USUARIO');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS juridico.usuarios (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  nombre        TEXT NOT NULL,
  email         TEXT UNIQUE,
  rol           juridico.rol_usuario NOT NULL DEFAULT 'USUARIO',
  password_hash TEXT NOT NULL,      
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON juridico.usuarios (rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON juridico.usuarios (activo);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_one_admin
  ON juridico.usuarios ((rol))
  WHERE rol = 'ADMIN';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_one_secretaria
  ON juridico.usuarios ((rol))
  WHERE rol = 'SECRETARIA';

INSERT INTO juridico.usuarios (username, nombre, email, rol, password_hash)
VALUES
  ('admin', 'Administrador', 'admin@local', 'ADMIN', crypt('Admin123!', gen_salt('bf'))),
  ('secretaria', 'Secretaria', 'secretaria@local', 'SECRETARIA', crypt('Secre123!', gen_salt('bf'))),
  ('usuario1', 'Usuario 1', 'usuario1@local', 'USUARIO', crypt('User123!', gen_salt('bf')))
ON CONFLICT (username) DO NOTHING;


CREATE INDEX IF NOT EXISTS idx_exp_varios_expediente ON juridico.exp_varios (expediente);
CREATE INDEX IF NOT EXISTS idx_exp_varios_actor ON juridico.exp_varios (actor);

CREATE OR REPLACE VIEW juridico.v_expedientes AS
SELECT 'amparos'::text AS tipo, id, no AS numero, expediente, fecha_emplazamiento AS fecha, juzgado, actor, demandado, asunto, estado_procesal, amparos, created_at
  FROM juridico.amparos
UNION ALL
SELECT 'administrativos', id, numero, expediente, fecha_emplazamiento, sala AS juzgado, actor, autoridad_demandada_demandado AS demandado, asunto, estado_procesal, amparos, created_at
  FROM juridico.administrativos
UNION ALL
SELECT 'laborales', id, numero, expediente, emplazamiento AS fecha, mesa AS juzgado, actor, NULL::text AS demandado, NULL::text AS asunto, estado_procesal, amparos, created_at
  FROM juridico.laborales
UNION ALL
SELECT 'civiles', id, no AS numero, expediente, fecha_inicio, juzgado, actor, demandado, asunto, estado_procesal, amparos, created_at
  FROM juridico.civiles
UNION ALL
SELECT 'mercantiles', id, no AS numero, expediente, fecha, juzgado, actor, NULL::text AS demandado, asunto, estado_procesal, NULL::text AS amparos, created_at
  FROM juridico.mercantiles
UNION ALL
SELECT 'penales', id, numero, expediente, NULL::text AS fecha, juzgado, actor, demandado, asunto, estado_procesal, NULL::text AS amparos, created_at
  FROM juridico.penales
UNION ALL
SELECT 'agrarios', id, numero, expediente, fecha_emplazamiento, juzgado, actor, NULL::text AS demandado, asunto, estado_procesal, amparos, created_at
  FROM juridico.agrarios
UNION ALL
SELECT 'exp_varios', id, numero, expediente, fecha_recibido, juzgado, actor, demandado, asunto, estado_procesal, NULL::text AS amparos, created_at
  FROM juridico.exp_varios
;


CREATE TABLE IF NOT EXISTS juridico.estado_caso (
  id BIGSERIAL PRIMARY KEY,
  clave TEXT NOT NULL UNIQUE,     
  nombre TEXT NOT NULL           
);


INSERT INTO juridico.estado_caso (clave, nombre) VALUES
  ('EN_PROCESO', 'En proceso'),
  ('SIN_ASIGNAR', 'Sin asignar'),
  ('ASIGNADO', 'Asignado'),
  ('FINALIZADO', 'Finalizado'),
  ('SIN_ACTIVIDAD', 'Sin actividad')
ON CONFLICT (clave) DO NOTHING;


DO $$
DECLARE v_default_id BIGINT;
BEGIN
  SELECT id INTO v_default_id
  FROM juridico.estado_caso
  WHERE clave = 'SIN_ASIGNAR';



  -- AMPAROS
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='juridico' AND table_name='amparos' AND column_name='estado_id'
  ) THEN
    EXECUTE format('ALTER TABLE juridico.amparos ADD COLUMN estado_id BIGINT NOT NULL DEFAULT %s;', v_default_id);
    EXECUTE 'ALTER TABLE juridico.amparos ADD CONSTRAINT fk_amparos_estado
             FOREIGN KEY (estado_id) REFERENCES juridico.estado_caso(id);';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_amparos_estado_id ON juridico.amparos(estado_id);';
  END IF;

  -- ADMINISTRATIVOS
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='juridico' AND table_name='administrativos' AND column_name='estado_id'
  ) THEN
    EXECUTE format('ALTER TABLE juridico.administrativos ADD COLUMN estado_id BIGINT NOT NULL DEFAULT %s;', v_default_id);
    EXECUTE 'ALTER TABLE juridico.administrativos ADD CONSTRAINT fk_administrativos_estado
             FOREIGN KEY (estado_id) REFERENCES juridico.estado_caso(id);';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_administrativos_estado_id ON juridico.administrativos(estado_id);';
  END IF;

  -- LABORALES
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='juridico' AND table_name='laborales' AND column_name='estado_id'
  ) THEN
    EXECUTE format('ALTER TABLE juridico.laborales ADD COLUMN estado_id BIGINT NOT NULL DEFAULT %s;', v_default_id);
    EXECUTE 'ALTER TABLE juridico.laborales ADD CONSTRAINT fk_laborales_estado
             FOREIGN KEY (estado_id) REFERENCES juridico.estado_caso(id);';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_laborales_estado_id ON juridico.laborales(estado_id);';
  END IF;

  -- CIVILES
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='juridico' AND table_name='civiles' AND column_name='estado_id'
  ) THEN
    EXECUTE format('ALTER TABLE juridico.civiles ADD COLUMN estado_id BIGINT NOT NULL DEFAULT %s;', v_default_id);
    EXECUTE 'ALTER TABLE juridico.civiles ADD CONSTRAINT fk_civiles_estado
             FOREIGN KEY (estado_id) REFERENCES juridico.estado_caso(id);';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_civiles_estado_id ON juridico.civiles(estado_id);';
  END IF;

  -- MERCANTILES
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='juridico' AND table_name='mercantiles' AND column_name='estado_id'
  ) THEN
    EXECUTE format('ALTER TABLE juridico.mercantiles ADD COLUMN estado_id BIGINT NOT NULL DEFAULT %s;', v_default_id);
    EXECUTE 'ALTER TABLE juridico.mercantiles ADD CONSTRAINT fk_mercantiles_estado
             FOREIGN KEY (estado_id) REFERENCES juridico.estado_caso(id);';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mercantiles_estado_id ON juridico.mercantiles(estado_id);';
  END IF;

  -- PENALES
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='juridico' AND table_name='penales' AND column_name='estado_id'
  ) THEN
    EXECUTE format('ALTER TABLE juridico.penales ADD COLUMN estado_id BIGINT NOT NULL DEFAULT %s;', v_default_id);
    EXECUTE 'ALTER TABLE juridico.penales ADD CONSTRAINT fk_penales_estado
             FOREIGN KEY (estado_id) REFERENCES juridico.estado_caso(id);';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_penales_estado_id ON juridico.penales(estado_id);';
  END IF;

  -- AGRARIOS
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='juridico' AND table_name='agrarios' AND column_name='estado_id'
  ) THEN
    EXECUTE format('ALTER TABLE juridico.agrarios ADD COLUMN estado_id BIGINT NOT NULL DEFAULT %s;', v_default_id);
    EXECUTE 'ALTER TABLE juridico.agrarios ADD CONSTRAINT fk_agrarios_estado
             FOREIGN KEY (estado_id) REFERENCES juridico.estado_caso(id);';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_agrarios_estado_id ON juridico.agrarios(estado_id);';
  END IF;

  -- EXP VARIOS
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='juridico' AND table_name='exp_varios' AND column_name='estado_id'
  ) THEN
    EXECUTE format('ALTER TABLE juridico.exp_varios ADD COLUMN estado_id BIGINT NOT NULL DEFAULT %s;', v_default_id);
    EXECUTE 'ALTER TABLE juridico.exp_varios ADD CONSTRAINT fk_exp_varios_estado
             FOREIGN KEY (estado_id) REFERENCES juridico.estado_caso(id);';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_exp_varios_estado_id ON juridico.exp_varios(estado_id);';
  END IF;

END $$;


ALTER TABLE juridico.amparos         ALTER COLUMN estado_id DROP DEFAULT;
ALTER TABLE juridico.administrativos ALTER COLUMN estado_id DROP DEFAULT;
ALTER TABLE juridico.laborales       ALTER COLUMN estado_id DROP DEFAULT;
ALTER TABLE juridico.civiles         ALTER COLUMN estado_id DROP DEFAULT;
ALTER TABLE juridico.mercantiles     ALTER COLUMN estado_id DROP DEFAULT;
ALTER TABLE juridico.penales         ALTER COLUMN estado_id DROP DEFAULT;
ALTER TABLE juridico.agrarios        ALTER COLUMN estado_id DROP DEFAULT;
ALTER TABLE juridico.exp_varios      ALTER COLUMN estado_id DROP DEFAULT;

SELECT a.id, a.expediente, e.clave, e.nombre
FROM juridico.amparos a
JOIN juridico.estado_caso e ON e.id = a.estado_id;

SELECT current_database();


SELECT * FROM juridico.estado_caso ORDER BY id;
