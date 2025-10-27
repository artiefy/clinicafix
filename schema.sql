-- Agregar campos a la tabla de procedimientos
ALTER TABLE procedures
  ADD COLUMN nombre VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN tiempo INT NOT NULL DEFAULT 0;

-- Permitir NULL en patient_id para procedimientos predefinidos
ALTER TABLE procedures
  ALTER COLUMN patient_id DROP NOT NULL;

-- Insertar 5 procedimientos iniciales con patient_id NULL
INSERT INTO procedures (id, patient_id, nombre, descripcion, tiempo, created_at)
VALUES
  (1, NULL, 'Radiografía', 'Radiografía de tórax', 30, NOW()),
  (2, NULL, 'Electrocardiograma', 'ECG', 20, NOW()),
  (3, NULL, 'Hemograma', 'Hemograma completo', 15, NOW()),
  (4, NULL, 'Ecografía', 'Ecografía abdominal', 25, NOW()),
  (5, NULL, 'TAC', 'TAC craneal', 40, NOW());
