import { NextRequest, NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { patient_procedures, procedure_audios } from "@/server/db/schema";

export async function PUT(_request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const id = Number(params.id);
        if (!Number.isFinite(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
        const body = await _request.json();
        const schema = z.object({
            descripcion: z.string().min(1).optional(),
            tiempo: z.number().optional(),
            audio_url: z.string().optional().nullable(),
        });
        const parsed = schema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

        const updateObj: Record<string, unknown> = {};
        if (typeof parsed.data.descripcion === "string")
            updateObj.descripcion = parsed.data.descripcion;
        if (typeof parsed.data.tiempo === "number") updateObj.tiempo = parsed.data.tiempo;
        if ("audio_url" in parsed.data) updateObj.audio_url = parsed.data.audio_url ?? null;

        await db.update(patient_procedures).set(updateObj).where(eq(patient_procedures.id, id));
        return NextResponse.json({ message: "Procedimiento de paciente actualizado" });
    } catch (err) {
        console.error("PUT /api/procedures/[id] error:", err);
        return NextResponse.json({ error: "Error actualizando procedimiento" }, { status: 500 });
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const id = Number(params.id);
        if (!Number.isFinite(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
        // borrar audios relacionados (si existe)
        await db.delete(procedure_audios).where(eq(procedure_audios.procedure_id, id));
        // borrar procedimiento asignado al paciente
        await db.delete(patient_procedures).where(eq(patient_procedures.id, id));
        return NextResponse.json({ message: "Procedimiento eliminado" });
    } catch (err) {
        console.error("DELETE /api/procedures/[id] error:", err);
        return NextResponse.json({ error: "Error borrando procedimiento" }, { status: 500 });
    }
}
