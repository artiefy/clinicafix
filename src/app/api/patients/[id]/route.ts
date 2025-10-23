import { NextRequest, NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { beds, discharges, patients } from "@/server/db/schema";
import { Patient } from "@/types";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const awaitedParams = await Promise.resolve(params);
    const id = Number(awaitedParams.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    const rows = await db.select().from(patients).where(eq(patients.id, id));
    const p = rows[0] as Patient | undefined;
    if (!p) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
    return NextResponse.json(p);
  } catch (err) {
    console.error("GET /api/patients/[id] error:", err);
    return NextResponse.json({ error: "Error obteniendo paciente" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();

    // esquema mínimo para manejar bed/status (mantener compatibilidad)
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
      // no abortar: permitimos que body contenga otros campos personales; continuar sin lanzar
    }
    const newBedId = parsed.success ? parsed.data.bed_id : undefined;
    const status = parsed.success ? parsed.data.status : undefined;

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

    // Mantener la lógica original para status manejados explícitamente
    if (status === "de alta") {
      await db.update(patients).set({ discharge_status: "de alta", bed_id: null }).where(eq(patients.id, patientId));
      if (prevBedId) await freeBed(prevBedId, "Limpieza");
      if (prevBedId) {
        try {
          await db.insert(discharges).values({
            patient: existingPatient.name,
            bed_id: prevBedId,
            status: "Alta",
            expected_time: new Date(),
          });
        } catch (insertErr) {
          console.error("Error inserting discharge record:", insertErr);
        }
      }
      return NextResponse.json({ message: "Paciente dado de alta y reasignaciones ejecutadas" });
    }

    if (status === "sin cama") {
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

    if (status === "diagnosticos_procedimientos") {
      await db.update(patients).set({ discharge_status: "diagnosticos_procedimientos" }).where(eq(patients.id, patientId));
      if (prevBedId) {
        await db.update(beds).set({ status: "Diagnostico y Procedimiento", last_update: new Date() }).where(eq(beds.id, prevBedId));
      }
      return NextResponse.json({ message: "Paciente marcado in diagnóstico/procedimiento (cama sigue ocupada)" });
    }

    if (status === "pre-egreso") {
      await db.update(patients).set({ discharge_status: "pre-egreso" }).where(eq(patients.id, patientId));
      if (prevBedId) {
        await db.update(beds).set({ status: "Pre-egreso", last_update: new Date() }).where(eq(beds.id, prevBedId));
      }
      return NextResponse.json({ message: "Paciente marcado como pre-egreso" });
    }

    // Si bed_id fue enviado explícitamente (asignación/desasignación)
    if (typeof parsed.success !== "undefined" && typeof parsed.data?.bed_id !== "undefined") {
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

    // NEW: aceptar y persistir campos personales enviados en body
    const allowedPersonal = [
      "name",
      "diagnostico",
      "procedimiento",
      "diagnosticos_procedimientos",
      "pre_egreso",
      "estimated_time",
      "city",
      "phone",
      "blood_type",
      "birth_date",
      "extra_comment",
    ];
    const updateObj: Record<string, unknown> = {};
    for (const k of allowedPersonal) {
      if (Object.prototype.hasOwnProperty.call(body, k)) {
        const val = (body as Record<string, unknown>)[k];
        // Persistir birth_date COMO STRING (si viene) para cumplir tipado de Drizzle
        if (k === "birth_date" && val != null && typeof val === "string" && val.trim() !== "") {
          updateObj[k] = val;
        } else {
          updateObj[k] = val ?? null;
        }
      }
    }
    if (Object.keys(updateObj).length > 0) {
      await db.update(patients).set(updateObj).where(eq(patients.id, patientId));
      return NextResponse.json({ message: "Paciente actualizado" });
    }

    return NextResponse.json({ error: "No hubo cambios" }, { status: 400 });
  } catch (_err) {
    console.error("PUT /api/patients/[id] error:", _err);
    return NextResponse.json({ error: "Error al actualizar paciente" }, { status: 500 });
  }
}
