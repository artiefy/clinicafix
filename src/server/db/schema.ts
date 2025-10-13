// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import { index, pgTableCreator } from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `icesi_${name}`);

// Tabla de camas
export const beds = createTable(
  "beds",
  (d) => ({
    id: d.serial().primaryKey(),
    status: d.varchar({ length: 32 }).notNull(), // Disponible, Ocupada, Limpieza, Reservada
    room: d.varchar({ length: 32 }),
    lastUpdate: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  }),
  (t) => [index("status_idx").on(t.status)],
);

// Tabla de egresos
export const discharges = createTable(
  "discharges",
  (d) => ({
    id: d.serial().primaryKey(),
    patient: d.varchar({ length: 128 }).notNull(),
    bedId: d.integer().notNull().references(() => beds.id),
    status: d.varchar({ length: 32 }).notNull(), // Pendiente, En Proceso, Completado
    expectedTime: d.timestamp({ withTimezone: true }),
    createdAt: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  }),
  (t) => [index("status_idx").on(t.status)],
);

export const posts = createTable(
  "post",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("name_idx").on(t.name)],
);
