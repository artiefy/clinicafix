import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";

import { db } from "@/server/db";
import { pre_egresos } from "@/server/db/schema";

const postSchema = z.object({
  patient_id: z.coerce.number().int().positive(),
  contenido: z.string(), // permitir vacío, validamos abajo
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const patientId = url.searchParams.get("patientId");
    if (patientId) {
      const pid = Number(patientId);
      if (!Number.isFinite(pid)) return NextResponse.json({ error: "patientId inválido" }, { status: 400 });
      const rows = await db.select().from(pre_egresos).where(eq(pre_egresos.patient_id, pid)).orderBy(pre_egresos.saved_at);
      return NextResponse.json(rows);
    }
    const rows = await db.select().from(pre_egresos).orderBy(pre_egresos.saved_at);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/pre_egresos error:", err);
    return NextResponse.json({ error: "Error al obtener pre-egresos" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("multipart/form-data")) {
      const form = await request.formData();
      const p = form.get("patient_id");
      const contenidoRaw = form.get("contenido");
      const contenido = typeof contenidoRaw === "string" ? contenidoRaw : "";
      const patient_id = typeof p === "string" ? Number(p) : Number(p);
      if (!Number.isFinite(patient_id)) return NextResponse.json({ error: "patient_id inválido" }, { status: 400 });

      const file = form.get("file");
      let finalContenido = contenido;
      if (file && typeof (file as File).arrayBuffer === "function") {
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        await fs.mkdir(uploadsDir, { recursive: true });
        const origName = (file as File).name ?? `preegreso-${Date.now()}.webm`;
        const safeName = `${Date.now()}-${origName.replace(/\s+/g, "_")}`;
        const filePath = path.join(uploadsDir, safeName);
        const buffer = Buffer.from(await (file as File).arrayBuffer());
        await fs.writeFile(filePath, buffer);
        const audioUrl = `/uploads/${safeName}`;
        // Si hay texto, lo guarda junto al audio; si no, solo el audio
        finalContenido = finalContenido
          ? `${finalContenido}\n\n[audio:${audioUrl}]`
          : `[audio:${audioUrl}]`;
      }

      // Siempre guardar contenido como string (aunque sea vacío)
      try {
        const inserted = await db.insert(pre_egresos).values({
          patient_id,
          contenido: finalContenido,
          saved_at: new Date(),
          created_at: new Date(),
        }).returning();
        return NextResponse.json(inserted?.[0] ?? { message: "Pre-egreso creado" });
      } catch (_e) {
        await db.insert(pre_egresos).values({
          patient_id,
          contenido: finalContenido,
          saved_at: new Date(),
          created_at: new Date(),
        });
        return NextResponse.json({ message: "Pre-egreso creado" });
      }
    } else {
      const body = await request.json();
      const parsed = postSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Body inválido" }, { status: 400 });
      const { patient_id, contenido } = parsed.data;
      // Si el texto viene vacío, guardar string vacío (no undefined)
      try {
        const inserted = await db.insert(pre_egresos).values({
          patient_id,
          contenido: typeof contenido === "string" ? contenido : "",
          saved_at: new Date(),
          created_at: new Date(),
        }).returning();
        return NextResponse.json(inserted?.[0] ?? { message: "Pre-egreso creado" });
      } catch (_e) {
        await db.insert(pre_egresos).values({
          patient_id,
          contenido: typeof contenido === "string" ? contenido : "",
          saved_at: new Date(),
          created_at: new Date(),
        });
        return NextResponse.json({ message: "Pre-egreso creado" });
      }
    }
  } catch (err) {
    console.error("POST /api/pre_egresos error:", err);
    return NextResponse.json({ error: "Error creando pre-egreso" }, { status: 500 });
  }
}
