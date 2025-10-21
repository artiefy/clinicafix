-- --- Add new combined column and egreso, migrate existing data ---
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS diagnosticos_procedimientos TEXT,
  ADD COLUMN IF NOT EXISTS pre_egreso VARCHAR(128);

-- Populate diagnosticos_procedimientos from existing diagnostico + procedimiento (if present)
-- Uses concat_ws to join non-empty values with " | ". If both NULL/empty, leaves NULL.
UPDATE patients
SET diagnosticos_procedimientos = NULLIF(
  concat_ws(' | ',
    NULLIF(trim(diagnostico), ''),
    NULLIF(trim(procedimiento), '')
  ),
  ''
)
WHERE diagnosticos_procedimientos IS NULL OR diagnosticos_procedimientos = '';

-- If you want to remove the old separate columns after verifying the migration, run:
-- ALTER TABLE patients DROP COLUMN IF EXISTS diagnostico;
-- ALTER TABLE patients DROP COLUMN IF EXISTS procedimiento;

-- Ensure pre_egreso column is populated from existing egreso (if some older column name differs adjust accordingly)
-- (If you already have column 'egreso' this will do nothing.)
-- If you had an older egreso column name, migrate similarly:
-- UPDATE patients SET pre_egreso = <old_column> WHERE pre_egreso IS NULL;

-- Rename existing 'egreso' to 'pre_egreso' if present, otherwise add 'pre_egreso'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'egreso'
  ) THEN
    ALTER TABLE patients RENAME COLUMN egreso TO pre_egreso;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'pre_egreso'
  ) THEN
    ALTER TABLE patients ADD COLUMN pre_egreso VARCHAR(128);
  END IF;
END$$;

-- Habitaciones
INSERT INTO rooms (number) VALUES (101), (102), (103);

-- Camas
INSERT INTO beds (room_id, status, last_update) VALUES
  (1, 'Disponible', NOW()),
  (1, 'Ocupada', NOW()),
  (2, 'Limpieza', NOW()),
  (2, 'Disponible', NOW()),
  (3, 'Ocupada', NOW());

-- Pacientes (ajustado: se usa pre_egreso)
INSERT INTO patients (name, bed_id, diagnostico, procedimiento, pre_egreso, discharge_status, estimated_time) VALUES
  ('Juan Perez', 2, 'Neumonía', 'Oxigenoterapia', NULL, 'con cama', '08:30:00'),
  ('Maria Gomez', NULL, 'Fractura', 'Cirugía', NULL, 'sin cama', '09:00:00'),
  ('Carlos Ruiz', 5, 'COVID-19', 'Ventilación', NULL, 'con cama', '10:15:00'),
  ('Ana Torres', NULL, NULL, NULL, NULL, 'de alta', '07:45:00');

-- Egresos
INSERT INTO discharges (patient, bed_id, status, expected_time, created_at) VALUES
  ('Ana Torres', 4, 'Alta', NOW(), NOW());

-- Predicciones
INSERT INTO predictions (description, created_at) VALUES
  ('Se espera alta de 2 pacientes en las próximas 24 horas.', NOW()),
  ('Probabilidad de ocupación total en sala 101: 80%', NOW());

-- Alertas
INSERT INTO alerts (bed_id, type, timestamp) VALUES
  (3, 'pendiente', NOW()),
  (2, 'en_proceso', NOW());
