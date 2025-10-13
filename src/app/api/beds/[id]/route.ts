import { NextRequest, NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { beds } from "@/server/db/schema";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { status } = await request.json();
    if (!status) {
      return NextResponse.json({ error: "Status requerido" }, { status: 400 });
    }
    await db.update(beds).set({ status }).where(eq(beds.id, parseInt(params.id)));
    return NextResponse.json({ message: "Cama actualizada" });
  } catch (_err) {
    return NextResponse.json({ error: "Error al actualizar cama" }, { status: 500 });
  }
}
