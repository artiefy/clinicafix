import { NextResponse } from "next/server";

import { z } from "zod";

import { db } from "@/server/db";
import { patients } from "@/server/db/schema";
import { Patient } from "@/types";

export async function GET() {
  try {
    try {
      const patientsData = await db.select().from(patients);
      if (!Array.isArray(patientsData)) {
        console.error("GET /api/patients: resultado inesperado:", patientsData);
        return NextResponse.json([] as Patient[]);
      }
      return NextResponse.json(patientsData as Patient[]);
    } catch (err: unknown) {
      // Si falla la consulta con schema, loguear y devolver array vacío.
      // Nota: evita intentar raw queries aquí (db.query) porque en este proyecto causa errores de tipado.
      console.error(
        "GET /api/patients: fallo en consulta con schema. Revisa que el schema y la BD estén sincronizados.",
        err
      );
      return NextResponse.json([] as Patient[]);
    }
  } catch (outer) {
    console.error("GET /api/patients: error no manejado:", outer);
    return NextResponse.json([] as Patient[]);
  }
}

// Crear paciente (incluye campos personales nuevos)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const schema = z.object({
      name: z.string().min(1),
      bed_id: z.number().nullable().optional(),
      diagnostico: z.string().optional(),
      procedimiento: z.string().optional(),
      diagnosticos_procedimientos: z.string().optional(),
      pre_egreso: z.string().optional(),
      discharge_status: z.string().optional(),
      estimated_time: z.string().nullable().optional(),
      city: z.string().optional(),
      phone: z.string().optional(),
      blood_type: z.string().optional(),
      birth_date: z.string().optional(),
      extra_comment: z.string().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }
    const v = parsed.data;
    const insertValues = {
      name: v.name,
      bed_id: typeof v.bed_id === "number" ? v.bed_id : null,
      diagnostico: v.diagnostico ?? null,
      procedimiento: v.procedimiento ?? null,
      diagnosticos_procedimientos: v.diagnosticos_procedimientos ?? null,
      pre_egreso: v.pre_egreso ?? null,
      discharge_status: v.discharge_status ?? "activo",
      estimated_time: v.estimated_time ?? null,
      city: v.city ?? null,
      phone: v.phone ?? null,
      blood_type: v.blood_type ?? null,
      // IMPORTANT: pass birth_date as string (YYYY-MM-DD or ISO) — Drizzle expects string/null for date columns
      birth_date: v.birth_date ? String(v.birth_date) : null,
      extra_comment: v.extra_comment ?? null,
    };

    // intentar insertar y devolver el registro insertado (si DB/driver soporta returning)
    try {
      const created = await db.insert(patients).values(insertValues).returning();
      return NextResponse.json(created?.[0] ?? { message: "Paciente creado" });
    } catch (e) {
      console.error("Insert returning fallback error:", e);
      // fallback: insertar sin relying on returning()
      await db.insert(patients).values(insertValues);
      return NextResponse.json({ message: "Paciente creado" });
    }
  } catch (err) {
    console.error("POST /api/patients error:", err);
    return NextResponse.json({ error: "Error creando paciente" }, { status: 500 });
  }
}
