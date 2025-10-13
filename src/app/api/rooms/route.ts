import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { rooms } from "@/server/db/schema";
import { Room } from "@/types";

export async function GET() {
  try {
    const roomsData = await db.select().from(rooms);
    return NextResponse.json(roomsData as Room[]);
  } catch (_err) {
    return NextResponse.json({ error: "Error al obtener habitaciones" }, { status: 500 });
  }
}
