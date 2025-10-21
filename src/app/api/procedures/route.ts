import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";

import { db } from "@/server/db";
import { procedure_audios, procedures } from "@/server/db/schema";

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const patientId = url.searchParams.get("patientId");
        if (!patientId) return NextResponse.json({ error: "patientId requerido" }, { status: 400 });
        const pid = Number(patientId);
        if (!Number.isFinite(pid)) return NextResponse.json({ error: "patientId inválido" }, { status: 400 });
        const rows = await db.select().from(procedures).where(eq(procedures.patient_id, pid)).orderBy(procedures.created_at);
        return NextResponse.json(rows);
    } catch (err) {
        console.error("GET /api/procedures error:", err);
        return NextResponse.json({ error: "Error al obtener procedimientos" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const ct = request.headers.get("content-type") ?? "";
        if (ct.includes("multipart/form-data")) {
            // parse form data safely and ensure types
            const form = await request.formData();
            const p = form.get("patient_id");
            const descRaw = form.get("descripcion");
            const descripcion = typeof descRaw === "string" ? descRaw : "";
            const patient_id = typeof p === "string" ? Number(p) : Number(p);
            if (!Number.isFinite(patient_id)) return NextResponse.json({ error: "patient_id inválido" }, { status: 400 });

            // insert procedure row first (without audio)
            const inserted = await db.insert(procedures).values({ patient_id, descripcion }).returning();
            const proc = inserted[0];

            // helper type-guard for File-like objects in formData
            function isFileLike(v: unknown): v is File {
                return typeof v === "object" && v !== null && typeof (v as File).arrayBuffer === "function";
            }

            const file = form.get("file");
            if (isFileLike(file)) {
                const uploadsDir = path.join(process.cwd(), "public", "uploads");
                await fs.mkdir(uploadsDir, { recursive: true });
                const origName = (file as File).name ?? `upload-${Date.now()}.webm`;
                const safeName = `${Date.now()}-${origName.replace(/\s+/g, "_")}`;
                const filePath = path.join(uploadsDir, safeName);
                const buffer = Buffer.from(await (file as File).arrayBuffer());
                await fs.writeFile(filePath, buffer);
                const audioUrl = `/uploads/${safeName}`;
                await db.insert(procedure_audios).values({
                    procedure_id: proc.id,
                    patient_id,
                    audio_url: audioUrl,
                });
                return NextResponse.json({ ...proc, audio_url: audioUrl });
            }

            return NextResponse.json(proc);
        } else {
            // Validación segura del JSON usando zod (acepta strings numéricos y los coerciona)
            const body = await request.json();
            const schema = z.object({
                patient_id: z.coerce.number(),
                descripcion: z.string().optional().transform((s) => (s ?? "").trim()),
            });
            const parsed = schema.safeParse(body);
            if (!parsed.success) {
                return NextResponse.json({ error: "body inválido" }, { status: 400 });
            }
            const { patient_id, descripcion } = parsed.data;
            if (!Number.isFinite(patient_id)) return NextResponse.json({ error: "patient_id inválido" }, { status: 400 });
            const inserted = await db.insert(procedures).values({ patient_id, descripcion }).returning();
            return NextResponse.json(inserted[0] ?? null);
        }
    } catch (err) {
        console.error("POST /api/procedures error:", err);
        return NextResponse.json({ error: "Error creando procedimiento" }, { status: 500 });
    }
}
