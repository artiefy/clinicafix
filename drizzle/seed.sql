-- Insert sample rooms
INSERT INTO rooms (id, number) VALUES
(1, 101),
(2, 102),
(3, 103),
(4, 104);

-- Insert sample beds (ajustar nombre de columna de referencia de habitación)
-- Si tu tabla beds usa "room_id" en vez de "roomid", actualiza el nombre de la columna:
INSERT INTO beds (id, room_id, status, last_update) VALUES
(1, 1, 'Disponible', '2024-06-10 13:00:00'),
(2, 2, 'Limpieza', '2024-06-10 12:45:00'),
(3, 3, 'Ocupada', '2024-06-10 11:30:00'),
(4, 4, 'Limpieza', '2024-06-10 13:10:00');

-- Más camas de ejemplo
INSERT INTO beds (id, room_id, status, last_update) VALUES
(5, 1, 'Disponible', '2024-06-10 13:20:00'),
(6, 2, 'Disponible', '2024-06-10 13:05:00'),
(7, 3, 'Ocupada', '2024-06-10 11:50:00'),
(8, 4, 'Disponible', '2024-06-10 12:55:00');

-- Insert sample patients
-- If you allow patients.bed_id = NULL (migration), you can seed NULL values.
ALTER TABLE patients ALTER COLUMN bed_id DROP NOT NULL;

INSERT INTO patients (id, name, bed_id, discharge_status, estimated_time) VALUES
(1, 'Juan Pérez', 1, 'con cama', '13:30:00'),
(2, 'Ana Gómez', 3, 'con cama', '14:00:00'),
(3, 'Carlos Ruiz', 2, 'con cama', '15:00:00'),
(4, 'Laura Díaz', 5, 'con cama', '15:30:00'),
(5, 'Paciente Sin Cama', NULL, 'sin cama', NULL),
(6, 'María López', NULL, 'sin cama', NULL),
(7, 'Pedro Márquez', 6, 'con cama', '16:00:00'),
(8, 'Sofia Ruiz', NULL, 'sin cama', NULL),
(9, 'Diego Torres', 7, 'con cama', '16:30:00'),
(10, 'Paciente Alta', NULL, 'de alta', NULL);

-- Insert sample predictions
INSERT INTO predictions (id, description) VALUES
(1, 'Se prevé liberar 5 camas antes de las 14:00h. Tiempo promedio de limpieza: 45 min.'),
(2, 'Alta probabilidad de ocupación en el ala norte en próxima hora; priorizar limpieza.');

-- Insert sample alerts
-- Si cambiaste "bed_id" por otro nombre en el schema, actualiza aquí también:
INSERT INTO alerts (id, bed_id, type, timestamp) VALUES
(1, 2, 'En Proceso', '2024-06-10 12:45:00'),
(2, 4, 'Pendiente', '2024-06-10 13:10:00'),
(3, 5, 'Pendiente', '2024-06-10 13:20:00'),
(4, 6, 'En Proceso', '2024-06-10 13:05:00');

-- Más egresos (discharges) — use full timestamp for expected_time (column is TIMESTAMP WITH TIME ZONE)
INSERT INTO discharges (id, patient, bed_id, status, expected_time) VALUES
  (1, 'Juan Pérez', 1, 'En Proceso', '2024-06-10 13:30:00'),
  (2, 'Ana Gómez', 3, 'Pendiente', '2024-06-10 14:00:00'),
  (3, 'María López', 5, 'Pendiente', NULL),
  (4, 'Pedro Márquez', 6, 'En Proceso', '2024-06-10 16:00:00')
ON CONFLICT (id) DO NOTHING;

