import { NextRequest, NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { beds, patients } from "@/server/db/schema";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const schema = z.object({
      status: z.union([
        z.literal("Disponible"),
        z.literal("Limpieza"),
        z.literal("Atención Médica"),
        z.literal("Diagnostico y Procedimiento"),
        z.literal("Pre-egreso"),
      ]),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    const status = parsed.data.status;

    const id = parseInt((await Promise.resolve(params)).id, 10);
    if (Number.isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    // Buscar paciente asignado (si existe)
    const assigned = await db.select().from(patients).where(eq(patients.bed_id, id)).limit(1);
    const hasAssigned = assigned.length > 0;
    const assignedPatient = hasAssigned ? assigned[0] : null;

    // Si hay paciente asignado y NO está dado de alta, no permitir cambiar a Disponible/Limpieza
    if (hasAssigned && assignedPatient && assignedPatient.discharge_status !== "de alta") {
      if (status === "Disponible" || status === "Limpieza") {
        return NextResponse.json(
          { error: "No se puede cambiar la cama a Disponible/Limpieza: la cama tiene un paciente activo. Marque al paciente como 'de alta' primero." },
          { status: 400 }
        );
      }
      // permitir cambios a Ocupada, Diagnostico, Procedimiento o Pre-egreso
    }

    // Si se intenta poner la cama en 'Disponible' o 'Limpieza' pero hay paciente asignado marcado 'de alta',
    // liberar la relación (mejor práctica: patients API debería haber hecho bed_id = null; igual permitimos)
    if ((status === "Disponible" || status === "Limpieza") && hasAssigned && assignedPatient?.discharge_status === "de alta") {
      // Desasignar paciente por consistencia
      await db.update(patients).set({ bed_id: null }).where(eq(patients.id, assignedPatient.id));
    }

    await db.update(beds).set({ status, last_update: new Date() }).where(eq(beds.id, id));
    return NextResponse.json({ message: "Cama actualizada" });
  } catch (_err) {
    return NextResponse.json({ error: "Error al actualizar cama" }, { status: 500 });
  }
}
