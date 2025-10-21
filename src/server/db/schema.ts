import { sql } from "drizzle-orm";
import { index, pgTableCreator } from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `${name}`);

// Tabla de habitaciones (rooms)
export const rooms = createTable(
  "rooms",
  (d) => ({
    id: d.serial().primaryKey(),
    number: d.integer().notNull(), // número de habitación
  }),
  (t) => [index("rooms_number_idx").on(t.number)]
);

// Tabla de camas (beds)
export const beds = createTable(
  "beds",
  (d) => ({
    id: d.serial().primaryKey(),
    room_id: d.integer().notNull().references(() => rooms.id),
    status: d.varchar({ length: 32 }).notNull(), // Disponible, Ocupada, Limpieza, Mantenimiento, Aislamiento, Reserva
    last_update: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  }),
  (t) => [index("beds_status_idx").on(t.status)]
);

// Tabla de pacientes (patients)
export const patients = createTable(
  "patients",
  (d) => ({
    id: d.serial().primaryKey(),
    name: d.varchar({ length: 128 }).notNull(),
    bed_id: d.integer().references(() => beds.id),
    diagnostico: d.varchar({ length: 256 }),
    procedimiento: d.varchar({ length: 256 }),
    pre_egreso: d.varchar({ length: 128 }),
    diagnosticos_procedimientos: d.text(),
    discharge_status: d.varchar({ length: 32 }).notNull(),
    estimated_time: d.time(),
  }),
  (t) => [index("patients_discharge_status_idx").on(t.discharge_status)]
);

// Tabla de historial de paciente (patient_history)
export const patient_history = createTable(
  "patient_history",
  (d) => ({
    id: d.serial().primaryKey(),
    patient_id: d.integer().notNull().references(() => patients.id),
    tipo: d.varchar({ length: 16 }).notNull(), // texto | audio
    contenido: d.text().notNull(),
    fecha: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  })
);

// Tabla de egresos (discharges)
export const discharges = createTable(
  "discharges",
  (d) => ({
    id: d.serial().primaryKey(),
    patient: d.varchar({ length: 128 }).notNull(),
    bed_id: d.integer().notNull().references(() => beds.id),
    status: d.varchar({ length: 32 }).notNull(), // pendiente, en_proceso, completado
    expected_time: d.timestamp({ withTimezone: true }),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  }),
  (t) => [index("discharges_status_idx").on(t.status)]
);

// Tabla de predicciones (predictions)
export const predictions = createTable(
  "predictions",
  (d) => ({
    id: d.serial().primaryKey(),
    description: d.varchar({ length: 512 }).notNull(),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  })
);

// Tabla de alertas (alerts)
export const alerts = createTable(
  "alerts",
  (d) => ({
    id: d.serial().primaryKey(),
    bed_id: d.integer().notNull().references(() => beds.id),
    type: d.varchar({ length: 32 }).notNull(), // en_proceso, pendiente, etc.
    timestamp: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  }),
  (t) => [index("alerts_type_idx").on(t.type)]
);

// Tabla de posts (post)
export const posts = createTable(
  "post",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("name_idx").on(t.name)]
);
