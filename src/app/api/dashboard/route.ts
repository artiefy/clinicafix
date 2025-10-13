import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { beds } from "@/server/db/schema";
import { Bed } from "@/types";

export async function GET() {
  try {
    const bedsData = await db.select().from(beds);
    return NextResponse.json(bedsData as Bed[]);
  } catch (_err) {
    return NextResponse.json({ error: "Error al obtener camas" }, { status: 500 });
  }
}
