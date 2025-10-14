"use client";
import { useEffect, useState } from "react";

import { Bed, Discharge, Room } from "@/types";
import { to12Hour } from "@/utils/time";

export default function EgressTracker() {
  const [discharges, setDischarges] = useState<Discharge[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // Polling: re-fetch every 5s so table updates in "real time"
  useEffect(() => {
    let mounted = true;
    const fetchAll = async () => {
      try {
        const [disRes, bedsRes, roomsRes] = await Promise.all([
          fetch("/api/discharges"),
          fetch("/api/beds"),
          fetch("/api/rooms"),
        ]);
        if (!mounted) return;
        const disData = (await disRes.json()) as Discharge[];
        const bedsData = (await bedsRes.json()) as Bed[];
        const roomsData = (await roomsRes.json()) as Room[];
        setDischarges(disData ?? []);
        setBeds(bedsData ?? []);
        setRooms(roomsData ?? []);
      } catch {
        if (!mounted) return;
        setDischarges([]);
        setBeds([]);
        setRooms([]);
      }
    };

    fetchAll();
    const id = setInterval(fetchAll, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const getRoomNumberForBed = (bedId: number | null | undefined) => {
    if (!bedId) return "—";
    const bed = beds.find((b) => b.id === bedId);
    if (!bed) return "—";
    return rooms.find((r) => r.id === bed.room_id)?.number ?? bed.room_id ?? "—";
  };

  return (
    <section className="bg-white/10 rounded-xl p-6 text-white shadow">
      <h3 className="text-xl font-bold mb-4">Salidas De Pacientes</h3>
      <table className="w-full table-fixed text-left">
        <colgroup>
          <col className="w-1/5" />
          <col className="w-1/5" />
          <col className="w-1/5" />
          <col className="w-1/5" />
          <col className="w-1/5" />
        </colgroup>
        <thead>
          <tr>
            <th className="px-4 py-2">#</th>
            <th className="px-4 py-2">Paciente</th>
            <th className="px-4 py-2">Cama</th>
            <th className="px-4 py-2">Habitación</th>
            <th className="px-4 py-2">Hora De Salida</th>
          </tr>
        </thead>
        <tbody>
          {discharges.map((discharge, idx) => (
            <tr key={discharge.id}>
              <td className="px-4 py-2">{idx + 1}</td>
              <td className="px-4 py-2">{discharge.patient}</td>
              <td className="px-4 py-2">{discharge.bed_id}</td>
              <td className="px-4 py-2">{getRoomNumberForBed(discharge.bed_id)}</td>
              <td className="px-4 py-2">{to12Hour(discharge.expected_time)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
