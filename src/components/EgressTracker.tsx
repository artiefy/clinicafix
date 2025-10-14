"use client";
import useSWR from "swr";

import { Bed, Discharge, Room } from "@/types";
import { to12Hour } from "@/utils/time";

export default function EgressTracker() {
  const { data: discharges } = useSWR<Discharge[]>("/api/discharges");
  const { data: beds } = useSWR<Bed[]>("/api/beds");
  const { data: rooms } = useSWR<Room[]>("/api/rooms");

  // SWR devuelve undefined mientras carga; usar fallback vacío para render
  const disList = discharges ?? [];
  const bedList = beds ?? [];
  const roomList = rooms ?? [];

  const getRoomNumberForBed = (bedId: number | null | undefined) => {
    if (!bedId) return "—";
    const bed = bedList.find((b) => b.id === bedId);
    if (!bed) return "—";
    return roomList.find((r) => r.id === bed.room_id)?.number ?? bed.room_id ?? "—";
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
          {disList.map((discharge, idx) => (
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
