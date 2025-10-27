BEGIN;

-- Asegurar que la columna audio_url existe en procedures (si el schema la define pero la tabla no la tiene)
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- 1) crear tabla intermedia para procedimientos asignados a pacientes
CREATE TABLE IF NOT EXISTS patient_procedures (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL,
  procedure_id INTEGER, -- referencia opcional al template en procedures.id
  nombre TEXT,
  descripcion TEXT,
  tiempo INTEGER,
  audio_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2) migrar registros existentes de procedures que estaban ligados a pacientes
INSERT INTO patient_procedures (patient_id, procedure_id, nombre, descripcion, tiempo, audio_url, created_at)
SELECT patient_id, id, nombre, descripcion, tiempo, audio_url, created_at
FROM procedures
WHERE patient_id IS NOT NULL AND patient_id <> 0;

-- 3) eliminar las filas migradas de la tabla procedures (dejamos plantillas con patient_id = 0)
DELETE FROM procedures WHERE patient_id IS NOT NULL AND patient_id <> 0;

COMMIT;
