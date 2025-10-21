import { NextResponse } from "next/server";

import { z } from "zod";

import { db } from "@/server/db";
import { patient_history } from "@/server/db/schema";
import { PatientHistory } from "@/types";

export async function GET() {
  try {
    const rows = await db.select().from(patient_history).orderBy(patient_history.fecha);
    if (!Array.isArray(rows)) {
      console.error("GET /api/patient_history: resultado inesperado:", rows);
      return NextResponse.json([] as PatientHistory[]);
    }
    return NextResponse.json(rows as PatientHistory[]);
  } catch (err: unknown) {
    // Si la tabla no existe la BD devuelve error relation does not exist.
    // Devolvemos array vacío para que el frontend no rompa y logueamos el error para que lo verifiques.
    console.error("Error al obtener patient_history:", err);
    return NextResponse.json([] as PatientHistory[]);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const schema = z.object({
      patient_id: z.number().int().positive(),
      tipo: z.union([z.literal("texto"), z.literal("audio")]),
      contenido: z.string().min(1),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }
    const { patient_id, tipo, contenido } = parsed.data;
    const inserted = await db.insert(patient_history).values({
      patient_id,
      tipo,
      contenido,
      // fecha se rellenará por default en el schema (CURRENT_TIMESTAMP),
    }).returning();

    if (Array.isArray(inserted) && inserted.length > 0) {
      return NextResponse.json(inserted[0] as PatientHistory, { status: 201 });
    }
    return NextResponse.json({ message: "Historial creado" }, { status: 201 });
  } catch (err) {
    console.error("Error al crear patient_history:", err);
    return NextResponse.json({ error: "Error al crear historial" }, { status: 500 });
  }
}
