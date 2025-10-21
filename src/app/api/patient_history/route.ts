import { NextResponse } from "next/server";

import { z } from "zod";

import { db } from "@/server/db";
import { patient_history } from "@/server/db/schema";

const schema = z.object({
  patient_id: z.number().int().positive(),
  tipo: z.enum(["texto", "audio"]),
  contenido: z.string().min(1).max(2000),
  fecha: z.string().optional(), // ISO string opcional
});

export async function GET() {
  try {
    const rows = await db.select().from(patient_history).orderBy(patient_history.fecha);
    if (!Array.isArray(rows)) {
      console.error("GET /api/patient_history: resultado inesperado:", rows);
      return NextResponse.json([]);
    }
    return NextResponse.json(rows);
  } catch (err: unknown) {
    // Si la tabla no existe la BD devuelve error relation does not exist.
    // Devolvemos array vacío para que el frontend no rompa y logueamos el error para que lo verifiques.
    console.error("Error al obtener patient_history:", err);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const { patient_id, tipo, contenido, fecha } = parsed.data;

    // Asegurar que 'fecha' sea un objeto Date (Drizzle espera Date para timestamp)
    const fechaDate = fecha ? new Date(fecha) : new Date();

    const row = {
      patient_id,
      tipo,
      contenido,
      fecha: fechaDate,
    };

    await db.insert(patient_history).values(row);

    return NextResponse.json({ message: "Historial registrado" });
  } catch (err) {
    console.error("POST /api/patient_history error:", err);
    return NextResponse.json({ error: "Error guardando historial" }, { status: 500 });
  }
}
