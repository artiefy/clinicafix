import { NextResponse } from "next/server";

import { sql } from "drizzle-orm";

import { db } from "@/server/db";
import { beds } from "@/server/db/schema";
import { Bed } from "@/types";

export async function GET() {
  try {
    const bedsData = await db.select().from(beds);
    return NextResponse.json(bedsData as Bed[]);
  } catch (_err) {
    return NextResponse.json({ error: "Error al obtener camas" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as unknown;

    // Validación explícita y segura del body
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
    }
    const maybeId = (body as Record<string, unknown>).id;
    const maybeStatus = (body as Record<string, unknown>).status;
    const maybeAux = (body as Record<string, unknown>).aux_status;

    const id = typeof maybeId === "number" ? maybeId : Number(maybeId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const status = typeof maybeStatus === "string" ? maybeStatus : undefined;
    const aux_status = typeof maybeAux === "string" ? String(maybeAux) : undefined;

    // Si se pasó aux_status, validar valores permitidos
    const allowedAux = ["Limpieza", "Mantenimiento", "Aislamiento", "Reserva"];
    if (typeof aux_status === "string" && !allowedAux.includes(aux_status)) {
      return NextResponse.json({ error: "aux_status inválido" }, { status: 400 });
    }

    // Actualizamos last_update también al marcar como Disponible, Limpieza o Ocupada
    const updateFields: Record<string, unknown> = {};
    if (typeof status === "string") {
      updateFields.status = status;
      updateFields.last_update = new Date();
    }
    if (typeof aux_status === "string") {
      updateFields.aux_status = aux_status;
      updateFields.last_update = new Date();
    }
    // si no hay fields válidos, error
    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }
    await db.update(beds).set(updateFields).where(sql`${beds.id} = ${id}`);

    const updated = await db.select().from(beds).where(sql`${beds.id} = ${id}`);
    return NextResponse.json(updated[0] ?? null);
  } catch (err) {
    console.error("PUT /api/beds error:", err);
    return NextResponse.json({ error: "Error actualizando cama" }, { status: 500 });
  }
}
