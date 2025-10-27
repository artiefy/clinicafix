-- Elimina la tabla anterior si existe
DROP TABLE IF EXISTS bed_availability_predictions;

-- Crea la nueva tabla
CREATE TABLE bed_availability_predictions (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  camas_disponibles INTEGER NOT NULL,
  room_id INTEGER NOT NULL,
  probabilidad FLOAT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Índice para fecha
CREATE INDEX bed_availability_predictions_fecha_idx ON bed_availability_predictions(fecha);
