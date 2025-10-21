import { NextRequest, NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { beds, discharges, patients } from "@/server/db/schema";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const bodySchema = z.object({
      bed_id: z.number().nullable().optional(),
      status: z.union([
        z.literal("sin cama"),
        z.literal("con cama"),
        z.literal("de alta"),
        z.literal("diagnosticos_procedimientos"),
        z.literal("pre-egreso"),
      ]).optional(),
    });
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }
    const { bed_id: newBedId, status } = parsed.data;

    const awaitedParams = await Promise.resolve(params);
    const patientId = parseInt(awaitedParams.id, 10);
    if (Number.isNaN(patientId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // load current patient
    const [existingPatient] = await db.select().from(patients).where(eq(patients.id, patientId));
    if (!existingPatient) {
      return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
    }
    const prevBedId = existingPatient.bed_id ?? null;

    // Helper: liberar una cama indicando el estado destino (por ejemplo "Disponible" o "Limpieza")
    const freeBed = async (bedId: number | null, targetStatus = "Disponible") => {
      if (!bedId) return;
      // marcar estado (Disponible o Limpieza) y actualizar last_update
      await db.update(beds).set({ status: targetStatus, last_update: new Date() }).where(eq(beds.id, bedId));
    };

    const occupyBed = async (bedId: number) => {
      await db.update(beds).set({ status: "Atención Médica", last_update: new Date() }).where(eq(beds.id, bedId));
    };

    if (status === "de alta") {
      // marcar paciente como dado de alta y desasignar cama
      await db.update(patients).set({ discharge_status: "de alta", bed_id: null }).where(eq(patients.id, patientId));
      // cuando un paciente egresa, la cama debe ir a LIMPIEZA, no a Disponible
      if (prevBedId) await freeBed(prevBedId, "Limpieza");

      // record discharge row if previous bed exists (discharges.bed_id is NOT NULL in schema)
      if (prevBedId) {
        try {
          await db.insert(discharges).values({
            patient: existingPatient.name,
            bed_id: prevBedId,
            status: "Alta",
            expected_time: new Date(), // <-- la fecha/hora de salida
          });
        } catch (insertErr) {
          console.error("Error inserting discharge record:", insertErr);
        }
      }

      return NextResponse.json({ message: "Paciente dado de alta y reasignaciones ejecutadas" });
    }

    if (status === "sin cama") {
      // desasignación normal → la cama queda Disponible
      await db.update(patients).set({ discharge_status: "sin cama", bed_id: null }).where(eq(patients.id, patientId));
      if (prevBedId) await freeBed(prevBedId, "Disponible");
      return NextResponse.json({ message: "Paciente marcado como sin cama" });
    }

    if (status === "con cama") {
      if (typeof newBedId === "undefined" || newBedId === null) {
        return NextResponse.json({ error: "bed_id requerido para con cama" }, { status: 400 });
      }
      if (prevBedId && prevBedId !== newBedId) await freeBed(prevBedId);
      await db.update(patients).set({ discharge_status: "con cama", bed_id: newBedId }).where(eq(patients.id, patientId));
      await occupyBed(newBedId);
      return NextResponse.json({ message: "Paciente asignado a cama" });
    }

    // NEW: handle diagnosticos_procedimientos and pre-egreso statuses
    if (status === "diagnosticos_procedimientos") {
      // marcar paciente en diagnóstico/procedimiento pero mantener la cama asignada
      await db.update(patients).set({ discharge_status: "diagnosticos_procedimientos" }).where(eq(patients.id, patientId));
      // marcar la cama para que el frontend la muestre en la columna Diagnóstico/Proced.
      if (prevBedId) {
        await db.update(beds).set({ status: "Diagnostico y Procedimiento", last_update: new Date() }).where(eq(beds.id, prevBedId));
      }
      return NextResponse.json({ message: "Paciente marcado en diagnóstico/procedimiento (cama sigue ocupada)" });
    }

    if (status === "pre-egreso") {
      // mark as pre-egreso (keep bed assigned)
      await db.update(patients).set({ discharge_status: "pre-egreso" }).where(eq(patients.id, patientId));
      if (prevBedId) {
        await db.update(beds).set({ status: "Pre-egreso", last_update: new Date() }).where(eq(beds.id, prevBedId));
      }
      return NextResponse.json({ message: "Paciente marcado como pre-egreso" });
    }

    // If bed_id provided explicitly (assignment/unassignment)
    if (typeof parsed.data.bed_id !== "undefined") {
      if (newBedId == null) {
        await db.update(patients).set({ bed_id: null, discharge_status: "sin cama" }).where(eq(patients.id, patientId));
        if (prevBedId) await freeBed(prevBedId);
        return NextResponse.json({ message: "Paciente desasignado de cama" });
      } else {
        if (prevBedId && prevBedId !== newBedId) await freeBed(prevBedId);
        await db.update(patients).set({ bed_id: newBedId, discharge_status: "con cama" }).where(eq(patients.id, patientId));
        await occupyBed(newBedId);
        return NextResponse.json({ message: "Paciente asignado a cama" });
      }
    }

    return NextResponse.json({ error: "No hubo cambios" }, { status: 400 });
  } catch (_err) {
    return NextResponse.json({ error: "Error al actualizar paciente" }, { status: 500 });
  }
}
