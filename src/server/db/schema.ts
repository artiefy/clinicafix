import { sql } from "drizzle-orm";
import { index, pgTableCreator } from "drizzle-orm/pg-core";
import { doublePrecision, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

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
    aux_status: d.varchar({ length: 32 }), // Nuevo: estado auxiliar para la columna "Limpieza" (Limpieza, Mantenimiento, Aislamiento, Reserva)
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
    // nuevos campos personales
    city: d.varchar({ length: 128 }),
    phone: d.varchar({ length: 32 }),
    blood_type: d.varchar({ length: 8 }),
    birth_date: d.date(),
    extra_comment: d.text(),
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

// New: tabla de procedimientos por paciente
export const procedures = pgTable("procedures", {
  id: serial("id").primaryKey(),
  patient_id: integer("patient_id").notNull(),
  nombre: text("nombre").default(""),
  descripcion: text("descripcion").default(""),
  tiempo: integer("tiempo"), // <-- sin default
  audio_url: text("audio_url"), // <-- sin default
  created_at: timestamp("created_at").defaultNow(),
});

// Nuevo: tabla para audios de DIAGNÓSTICO (varios registros por paciente si se necesita)
export const diagnostic_audios = createTable(
  "diagnostic_audios",
  (d) => ({
    id: d.serial().primaryKey(),
    patient_id: d.integer().notNull().references(() => patients.id),
    audio_url: d.varchar({ length: 512 }).notNull(),
    audio_recorded_at: d.timestamp({ withTimezone: true }),
    audio_duration_seconds: d.integer(),
    audio_mime: d.varchar({ length: 64 }),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  }),
  (t) => [index("diagnostic_audios_patient_idx").on(t.patient_id)]
);

// Nuevo: tabla para almacenar varios audios por procedimiento
export const procedure_audios = createTable(
  "procedure_audios",
  (d) => ({
    id: d.serial().primaryKey(),
    procedure_id: d.integer().notNull().references(() => procedures.id),
    patient_id: d.integer().notNull().references(() => patients.id),
    audio_url: d.varchar({ length: 512 }).notNull(),
    audio_recorded_at: d.timestamp({ withTimezone: true }),
    audio_duration_seconds: d.integer(),
    audio_mime: d.varchar({ length: 64 }),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  }),
  (t) => [index("procedure_audios_procedure_idx").on(t.procedure_id), index("procedure_audios_patient_idx").on(t.patient_id)]
);

// Nuevo: tabla para pre-egresos (registros de pre-egreso por paciente)
export const pre_egresos = createTable(
  "pre_egresos",
  (d) => ({
    id: d.serial().primaryKey(),
    patient_id: d.integer().notNull().references(() => patients.id),
    contenido: d.text().notNull(),
    saved_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  }),
  (t) => [index("pre_egresos_patient_idx").on(t.patient_id)]
);

// NEW: tabla para epicrisis (almacenamos JSON como text por ahora)
export const epicrisis = createTable(
  "epicrisis",
  (d) => ({
    id: d.serial().primaryKey(),
    patient_id: d.integer().notNull().references(() => patients.id),
    epicrisis_text: d.text().notNull(), // JSON serializado
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  }),
  (t) => [index("epicrisis_patient_idx").on(t.patient_id)]
);

// NUEVO: tabla para procedimientos (definición de procedimientos)
export const procedures_definition = createTable(
  "procedures_definition",
  (d) => ({
    id: d.serial().primaryKey(),
    nombre: d.varchar({ length: 256 }).notNull(),
    descripcion: d.text(),
    tiempo_estimado: d.integer(), // en minutos
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  }),
  (t) => [index("procedures_definition_nombre_idx").on(t.nombre)]
);

// NUEVO: tabla para relacionar pacientes y procedimientos (historial de procedimientos)
export const patient_procedures = pgTable("patient_procedures", {
  id: serial("id").primaryKey(),
  patient_id: integer("patient_id").notNull(),
  procedure_id: integer("procedure_id"),
  nombre: text("nombre"),
  descripcion: text("descripcion"),
  tiempo: integer("tiempo"),
  audio_url: text("audio_url"),
  created_at: timestamp("created_at").defaultNow(),
});

// NUEVO: tabla para predicción de disponibilidad de camas
export const bed_availability_predictions = createTable(
  "bed_availability_predictions",
  (d) => ({
    id: d.serial().primaryKey(),
    fecha: d.date().notNull(), // fecha de la predicción (día)
    hora: d.time().notNull(),  // hora de la predicción (HH:mm)
    camas_disponibles: d.integer().notNull(), // número de camas disponibles en esa hora/día
    room_id: d.integer().notNull().references(() => rooms.id), // nueva columna para habitación
    probabilidad: doublePrecision("probabilidad").notNull(), // nueva columna para probabilidad (0-1)
    created_at: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  }),
  (t) => [index("bed_availability_predictions_fecha_idx").on(t.fecha)]
);
