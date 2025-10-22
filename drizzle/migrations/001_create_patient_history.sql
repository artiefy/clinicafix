CREATE TABLE IF NOT EXISTS patient_history (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  tipo VARCHAR(16) NOT NULL, -- 'texto' | 'audio'
  contenido TEXT NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- index para consultas por paciente / fecha
CREATE INDEX IF NOT EXISTS idx_patient_history_patient_id ON patient_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_history_fecha ON patient_history(fecha);
