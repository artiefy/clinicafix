import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { epicrisis } from "@/server/db/schema";

const bodySchema = z.object({
    patient_id: z.number().int().positive(),
    epicrisis: z.any(), // validamos en frontend; backend acepta cualquier JSON serializable
});

// GET: /api/epicrisis?patientId=123
export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const pid = url.searchParams.get("patientId");
        if (!pid) return NextResponse.json({ error: "patientId requerido" }, { status: 400 });
        const patientId = Number(pid);
        if (!Number.isFinite(patientId)) return NextResponse.json({ error: "patientId inválido" }, { status: 400 });
        const rows = await db.select().from(epicrisis).where(eq(epicrisis.patient_id, patientId)).orderBy(epicrisis.created_at);
        return NextResponse.json(rows);
    } catch (err) {
        console.error("GET /api/epicrisis error:", err);
        return NextResponse.json({ error: "Error obteniendo epicrisis" }, { status: 500 });
    }
}

// POST: crea o actualiza epicrisis por patient_id
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });
        const { patient_id, epicrisis: epic } = parsed.data;
        const epicText = typeof epic === "string" ? epic : JSON.stringify(epic);

        // intentar encontrar registro existente
        const existing = await db.select().from(epicrisis).where(eq(epicrisis.patient_id, patient_id)).limit(1);
        if (existing.length > 0) {
            await db.update(epicrisis).set({ epicrisis_text: epicText, updated_at: new Date() }).where(eq(epicrisis.patient_id, patient_id));
            const updated = await db.select().from(epicrisis).where(eq(epicrisis.patient_id, patient_id)).limit(1);
            return NextResponse.json(updated[0]);
        } else {
            const [inserted] = await db.insert(epicrisis).values({ patient_id, epicrisis_text: epicText, created_at: new Date(), updated_at: new Date() }).returning();
            return NextResponse.json(inserted ?? { message: "Epicrisis creada" });
        }
    } catch (err) {
        console.error("POST /api/epicrisis error:", err);
        return NextResponse.json({ error: "Error guardando epicrisis" }, { status: 500 });
    }
}
