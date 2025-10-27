import { NextResponse } from "next/server";

import { db } from "@/server/db";
import {
  bed_availability_predictions,
  beds,
  patients,
  rooms,
} from "@/server/db/schema";
import { BedAvailabilityPrediction } from "@/types";

export async function GET() {
  try {
    // Obtener predicciones
    const rows = await db.select().from(bed_availability_predictions).orderBy(bed_availability_predictions.fecha);

    // Obtener camas y habitaciones para mapear nombres
    const bedsRows = await db.select().from(beds);
    const roomsRows = await db.select().from(rooms);
    const patientsRows = await db.select().from(patients);

    // Mapas para lookup rápido
    const bedsMap = new Map<number, { id: number; room_id: number }>();
    bedsRows.forEach((b) => bedsMap.set(b.id, b));
    const roomsMap = new Map<number, { id: number; number: number }>();
    roomsRows.forEach((r) => roomsMap.set(r.id, r));
    const patientsMap = new Map<number, { id: number; name: string }>();
    patientsRows.forEach((p) => patientsMap.set(p.id, p));

    // Enriquecer cada predicción con el nombre real del paciente en pre-egreso
    const result: BedAvailabilityPrediction[] = rows.map((row) => {
      // Buscar paciente en pre-egreso asignado a la cama
      let pacienteNombre = row.proxima_salida_paciente;
      // Si tienes el patient_id en la tabla, úsalo; si no, busca por cama_id
      const paciente = patientsRows.find(
        (p) =>
          p.bed_id === row.cama_id &&
          (p.discharge_status === "pre-egreso" || p.discharge_status === "Pre-egreso")
      );
      if (paciente) pacienteNombre = paciente.name;

      // Obtener número de habitación real
      const habitacionId = row.habitacion_id;
      let habitacionNum = habitacionId;
      const roomObj = roomsMap.get(habitacionId);
      if (roomObj) habitacionNum = roomObj.number;

      return {
        ...row,
        proxima_salida_paciente: pacienteNombre,
        habitacion_id: habitacionNum,
        created_at: typeof row.created_at === "string"
          ? row.created_at
          : (row.created_at ? row.created_at.toISOString() : ""),
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/bed_availability_predictions error:", err);
    return NextResponse.json({ error: "Error al obtener predicciones" }, {
      status: 500,
    });
  }
}
