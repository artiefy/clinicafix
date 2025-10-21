import { NextRequest, NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { procedure_audios, procedures } from "@/server/db/schema";

export async function PUT(_request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const id = Number(params.id);
        if (!Number.isFinite(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
        const body = await _request.json();
        const schema = z.object({ descripcion: z.string().min(1) });
        const parsed = schema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: "descripcion inválida" }, { status: 400 });
        await db.update(procedures).set({ descripcion: parsed.data.descripcion }).where(eq(procedures.id, id));
        return NextResponse.json({ message: "Procedimiento actualizado" });
    } catch (err) {
        console.error("PUT /api/procedures/[id] error:", err);
        return NextResponse.json({ error: "Error actualizando procedimiento" }, { status: 500 });
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const id = Number(params.id);
        if (!Number.isFinite(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
        // borrar audios relacionados
        await db.delete(procedure_audios).where(eq(procedure_audios.procedure_id, id));
        // borrar procedimiento
        await db.delete(procedures).where(eq(procedures.id, id));
        return NextResponse.json({ message: "Procedimiento eliminado" });
    } catch (err) {
        console.error("DELETE /api/procedures/[id] error:", err);
        return NextResponse.json({ error: "Error borrando procedimiento" }, { status: 500 });
    }
}
