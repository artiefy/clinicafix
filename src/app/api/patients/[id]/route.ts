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
      status: z.union([z.literal("sin cama"), z.literal("con cama"), z.literal("de alta")]).optional(),
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

    const freeBed = async (bedId: number | null) => {
      if (!bedId) return;
      await db.update(beds).set({ status: "Disponible" }).where(eq(beds.id, bedId));
    };

    const occupyBed = async (bedId: number) => {
      await db.update(beds).set({ status: "Ocupada" }).where(eq(beds.id, bedId));
    };

    if (status === "de alta") {
      await db.update(patients).set({ discharge_status: "de alta", bed_id: null }).where(eq(patients.id, patientId));
      if (prevBedId) await freeBed(prevBedId);

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
      await db.update(patients).set({ discharge_status: "sin cama", bed_id: null }).where(eq(patients.id, patientId));
      if (prevBedId) await freeBed(prevBedId);
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
