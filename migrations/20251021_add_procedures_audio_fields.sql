-- Eliminar columna antigua (si existe) y crear tabla separada para audios de procedimiento

ALTER TABLE procedures
  DROP COLUMN IF EXISTS audio_url;

CREATE TABLE IF NOT EXISTS procedure_audios (
  id SERIAL PRIMARY KEY,
  procedure_id INTEGER NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  audio_url VARCHAR(512) NOT NULL,
  audio_recorded_at TIMESTAMP WITH TIME ZONE,
  audio_duration_seconds INTEGER,
  audio_mime VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS procedure_audios_procedure_idx ON procedure_audios (procedure_id);
CREATE INDEX IF NOT EXISTS procedure_audios_patient_idx ON procedure_audios (patient_id);
