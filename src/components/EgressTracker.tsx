"use client";
import { useEffect, useState } from "react";

import { Discharge } from "@/types";

function formatHour(date: Date | string | null | undefined) {
  if (!date) return "";
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function EgressTracker() {
  const [discharges, setDischarges] = useState<Discharge[]>([]);

  useEffect(() => {
    fetch("/api/discharges")
      .then((res) => res.json())
      .then((data: Discharge[]) => setDischarges(data))
      .catch(() => setDischarges([]));
  }, []);

  return (
    <section className="bg-white/10 rounded-xl p-6 text-white shadow">
      <h3 className="text-xl font-bold mb-4">Salidas De Pacientes</h3>
      <table className="w-full table-fixed text-left">
        <colgroup>
          <col className="w-1/4" />
          <col className="w-1/4" />
          <col className="w-1/4" />
          <col className="w-1/4" />
        </colgroup>
        <thead>
          <tr>
            <th className="px-4 py-2">#</th>
            <th className="px-4 py-2">Paciente</th>
            <th className="px-4 py-2">Cama</th>
            <th className="px-4 py-2">Hora De Salida</th>
          </tr>
        </thead>
        <tbody>
          {discharges.map((discharge, idx) => (
            <tr key={discharge.id}>
              <td className="px-4 py-2">{idx + 1}</td>
              <td className="px-4 py-2">{discharge.patient}</td>
              <td className="px-4 py-2">{discharge.bed_id}</td>
              <td className="px-4 py-2">{formatHour(discharge.expected_time)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
