import { NextResponse } from "next/server";

import { eq, InferSelectModel } from "drizzle-orm";

import { db } from "@/server/db";
import { bed_availability_predictions, rooms } from "@/server/db/schema";
import { BedAvailabilityPrediction } from "@/types";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const _tipo = url.searchParams.get("tipo"); // "hora" o "dia" (no se usa para filtrar ahora)
    const dateParam = url.searchParams.get("date"); // opcional: YYYY-MM-DD

    // Si se pasa ?date=YYYY-MM-DD filtramos por esa fecha; si no se pasa devolvemos todas las filas ordenadas.
    let rawRows;
    if (dateParam) {
      const parsed = String(dateParam);
      rawRows = await db
        .select({
          id: bed_availability_predictions.id,
          fecha: bed_availability_predictions.fecha,
          hora: bed_availability_predictions.hora,
          camas_disponibles: bed_availability_predictions.camas_disponibles,
          room_id: bed_availability_predictions.room_id,
          probabilidad: bed_availability_predictions.probabilidad,
          habitacion: rooms.number,
          created_at: bed_availability_predictions.created_at,
        })
        .from(bed_availability_predictions)
        .leftJoin(rooms, eq(bed_availability_predictions.room_id, rooms.id))
        .where(eq(bed_availability_predictions.fecha, parsed))
        .orderBy(bed_availability_predictions.fecha, bed_availability_predictions.hora);
    } else {
      rawRows = await db
        .select({
          id: bed_availability_predictions.id,
          fecha: bed_availability_predictions.fecha,
          hora: bed_availability_predictions.hora,
          camas_disponibles: bed_availability_predictions.camas_disponibles,
          room_id: bed_availability_predictions.room_id,
          probabilidad: bed_availability_predictions.probabilidad,
          habitacion: rooms.number,
          created_at: bed_availability_predictions.created_at,
        })
        .from(bed_availability_predictions)
        .leftJoin(rooms, eq(bed_availability_predictions.room_id, rooms.id))
        .orderBy(bed_availability_predictions.fecha, bed_availability_predictions.hora);
    }

    // Agrupar por hora si tipo="hora"
    if (_tipo === "hora") {
      const grouped = rawRows.reduce((acc, r: InferSelectModel<typeof bed_availability_predictions> & { habitacion?: number | null }) => {
        const key = r.hora;
        if (!acc[key]) acc[key] = { hora: r.hora, camas_disponibles: 0, habitaciones: [] as number[], probabilidades: [] as number[] };
        acc[key].camas_disponibles += Number(r.camas_disponibles ?? 0);
        acc[key].habitaciones.push(r.habitacion ?? r.room_id ?? 0);
        acc[key].probabilidades.push(r.probabilidad ?? 0);
        return acc;
      }, {} as Record<string, { hora: string; camas_disponibles: number; habitaciones: number[]; probabilidades: number[] }>);

      const rows: BedAvailabilityPrediction[] = Object.values(grouped).map(g => ({
        id: 0, // dummy
        fecha: rawRows[0]?.fecha || '',
        hora: g.hora,
        camas_disponibles: g.camas_disponibles,
        room_id: 0, // dummy
        probabilidad: g.probabilidades.length > 0 ? g.probabilidades.reduce((a, b) => a + b, 0) / g.probabilidades.length : 0,
        habitaciones: g.habitaciones,
        created_at: '',
      }));

      return NextResponse.json(rows);
    }

    // Para tipo="dia" o sin tipo, devolver filas individuales (agrupación en frontend)
    const rows: BedAvailabilityPrediction[] = (Array.isArray(rawRows) ? rawRows : []).map((r: InferSelectModel<typeof bed_availability_predictions> & { habitacion?: number | null }) => ({
      id: Number(r.id),
      fecha: r.fecha, // ya es string (YYYY-MM-DD)
      hora: r.hora,   // ya es string (HH:mm)
      camas_disponibles: Number(r.camas_disponibles ?? 0),
      room_id: Number(r.room_id ?? 0),
      probabilidad: r.probabilidad, // ya es number
      habitaciones: [r.habitacion ?? r.room_id ?? 0], // array con uno
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ""),
    }));

    return NextResponse.json(rows);
  } catch (_err) {
    return NextResponse.json({ error: "Error obteniendo predicciones" }, { status: 500 });
  }
}
