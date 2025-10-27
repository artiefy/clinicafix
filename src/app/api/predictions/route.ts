import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { predictions } from "@/server/db/schema";
import { Prediction } from "@/types";

export async function GET() {
  try {
    const rows = await db.select().from(predictions);
    return NextResponse.json(rows as Prediction[]);
  } catch (_err) {
    return NextResponse.json({ error: "Error obteniendo predicciones" }, { status: 500 });
  }
}
