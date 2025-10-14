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

    const id = typeof maybeId === "number" ? maybeId : Number(maybeId);
    if (!Number.isFinite(id) || typeof maybeStatus !== "string") {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }
    const status = maybeStatus;

    // last_update SIEMPRE se actualiza para Limpieza y Disponible
    if (status === "Disponible" || status === "Limpieza") {
      await db
        .update(beds)
        .set({ status, last_update: new Date() })
        .where(sql`${beds.id} = ${id}`);
    } else {
      await db
        .update(beds)
        .set({ status })
        .where(sql`${beds.id} = ${id}`);
    }

    const updated = await db.select().from(beds).where(sql`${beds.id} = ${id}`);
    return NextResponse.json(updated[0] ?? null);
  } catch (err) {
    console.error("PUT /api/beds error:", err);
    return NextResponse.json({ error: "Error actualizando cama" }, { status: 500 });
  }
}
