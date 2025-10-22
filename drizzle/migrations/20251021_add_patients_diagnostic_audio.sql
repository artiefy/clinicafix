-- Eliminar columnas antiguas de patients (si quedaron de versiones previas)
ALTER TABLE patients
  DROP COLUMN IF EXISTS diagnostic_audio_url,
  DROP COLUMN IF EXISTS diagnostic_audio_recorded_at,
  DROP COLUMN IF EXISTS diagnostic_audio_duration_seconds;

-- Crear tabla para almacenar audios de diagnóstico (uno o varios por paciente)
CREATE TABLE IF NOT EXISTS diagnostic_audios (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  audio_url VARCHAR(512) NOT NULL,
  audio_recorded_at TIMESTAMP WITH TIME ZONE,
  audio_duration_seconds INTEGER,
  audio_mime VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS diagnostic_audios_patient_idx ON diagnostic_audios (patient_id);
CREATE INDEX IF NOT EXISTS diagnostic_audios_recorded_idx ON diagnostic_audios (audio_recorded_at);
