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

-- Insert sample patients
-- Si cambiaste "bed_id" por otro nombre en el schema, actualiza aquí también:
INSERT INTO patients (id, name, bed_id, discharge_status, estimated_time) VALUES
(1, 'Juan Pérez', 1, 'En Proceso', '13:30:00'),
(2, 'Ana Gómez', 3, 'Pendiente', '14:00:00');

-- Insert sample predictions
INSERT INTO predictions (id, description) VALUES
(1, 'Se prevé liberar 5 camas antes de las 14:00h. Tiempo promedio de limpieza: 45 min.');

-- Insert sample alerts
-- Si cambiaste "bed_id" por otro nombre en el schema, actualiza aquí también:
INSERT INTO alerts (id, bed_id, type, timestamp) VALUES
(1, 2, 'En Proceso', '2024-06-10 12:45:00'),
(2, 4, 'Pendiente', '2024-06-10 13:10:00');
