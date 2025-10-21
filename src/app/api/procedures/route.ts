import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { procedures } from "@/server/db/schema";
import { Procedure } from "@/types";

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const patientIdParam = url.searchParams.get("patientId");
        if (patientIdParam) {
            const pid = Number(patientIdParam);
            if (!Number.isFinite(pid)) return NextResponse.json({ error: "patientId inválido" }, { status: 400 });
            const rows = await db.select().from(procedures).where(eq(procedures.patient_id, pid)).orderBy(procedures.created_at);
            return NextResponse.json(rows as Procedure[]);
        }
        const rows = await db.select().from(procedures).orderBy(procedures.created_at);
        return NextResponse.json(rows as Procedure[]);
    } catch (err) {
        console.error("GET /api/procedures error:", err);
        return NextResponse.json({ error: "Error al obtener procedimientos" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const schema = z.object({
            patient_id: z.number().int().positive(),
            descripcion: z.string().min(1),
        });
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Body inválido" }, { status: 400 });
        }
        const { patient_id, descripcion } = parsed.data;
        const inserted = await db.insert(procedures).values({ patient_id, descripcion }).returning();
        // returning() puede devolver array; devolver el primer elemento
        const created = Array.isArray(inserted) ? inserted[0] : inserted;
        return NextResponse.json(created ?? null, { status: 201 });
    } catch (err) {
        console.error("POST /api/procedures error:", err);
        return NextResponse.json({ error: "Error al crear procedimiento" }, { status: 500 });
    }
}
