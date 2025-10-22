ALTER TABLE beds
  ADD COLUMN aux_status VARCHAR(32);

-- opcional: establecer un valor por defecto para filas existentes (ej. 'Limpieza')
-- UPDATE beds SET aux_status = 'Limpieza' WHERE aux_status IS NULL;
