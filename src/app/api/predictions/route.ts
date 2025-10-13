import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { predictions } from "@/server/db/schema";
import { Prediction } from "@/types";

export async function GET() {
  try {
    const predictionsData = await db.select().from(predictions);
    return NextResponse.json(predictionsData as Prediction[]);
  } catch (_err) {
    return NextResponse.json({ error: "Error al obtener predicciones" }, { status: 500 });
  }
}
