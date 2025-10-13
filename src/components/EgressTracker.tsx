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
      <h3 className="text-xl font-bold mb-4">Tracker de Egresos</h3>
      <table className="w-full text-left">
        <thead>
          <tr>
            <th>Paciente</th>
            <th>Cama</th>
            <th>Estado</th>
            <th>Hora estimada</th>
          </tr>
        </thead>
        <tbody>
          {discharges.map((discharge) => (
            <tr key={discharge.id}>
              <td>{discharge.patient}</td>
              <td>{discharge.bed_id}</td>
              <td>
                <span
                  className={`px-2 py-1 rounded ${discharge.status === "Completado"
                    ? "bg-green-600"
                    : discharge.status === "En Proceso"
                      ? "bg-blue-600"
                      : "bg-yellow-500"
                    }`}
                >
                  {discharge.status}
                </span>
              </td>
              <td>{formatHour(discharge.expected_time)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
