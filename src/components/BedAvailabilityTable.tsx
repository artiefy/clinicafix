"use client";
import useSWR from "swr";

import { BedAvailabilityPrediction } from "@/types";

export default function BedAvailabilityTable() {
  const { data } = useSWR<BedAvailabilityPrediction[]>("/api/bed_availability_predictions");
  const rows = data ?? [];

  // Helper: format hour/minutes
  function formatHora(hora: string) {
    if (!hora) return "—";
    const [h, m] = hora.split(":");
    return `${h}h ${m}m`;
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Tabla en días */}
      <div className="card shadow-lg rounded-xl bg-white/90">
        <h3 className="card-title text-2xl font-bold mb-4 text-gray-800">Disponibilidad de camas (por días)</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] table-auto rounded-xl overflow-hidden text-black">
            <thead className="bg-gradient-to-r from-blue-100 via-blue-200 to-blue-100 text-blue-900">
              <tr>
                <th className="px-4 py-3 font-semibold text-left">Fecha</th>
                <th className="px-4 py-3 font-semibold text-left">Cama</th>
                <th className="px-4 py-3 font-semibold text-left">Habitación</th>
                <th className="px-4 py-3 font-semibold text-left">Próxima salida</th>
                <th className="px-4 py-3 font-semibold text-left">Hora salida</th>
                <th className="px-4 py-3 font-semibold text-left">Probabilidad</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? "bg-white" : "bg-blue-50"}>
                  <td className="px-4 py-3">{row.fecha}</td>
                  <td className="px-4 py-3 font-bold text-blue-700">{row.cama_id}</td>
                  <td className="px-4 py-3">{row.habitacion_id}</td>
                  <td className="px-4 py-3">{row.proxima_salida_paciente}</td>
                  <td className="px-4 py-3">{row.hora_salida}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded bg-blue-200 text-blue-900 font-semibold">{row.probabilidad}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Tabla en minutos/horas */}
      <div className="card shadow-lg rounded-xl bg-white/90">
        <h3 className="card-title text-2xl font-bold mb-4 text-gray-800">Disponibilidad de camas (minutos/horas)</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] table-auto rounded-xl overflow-hidden text-black">
            <thead className="bg-gradient-to-r from-emerald-100 via-emerald-200 to-emerald-100 text-emerald-900">
              <tr>
                <th className="px-4 py-3 font-semibold text-left">Fecha</th>
                <th className="px-4 py-3 font-semibold text-left">Cama</th>
                <th className="px-4 py-3 font-semibold text-left">Habitación</th>
                <th className="px-4 py-3 font-semibold text-left">Próxima salida</th>
                <th className="px-4 py-3 font-semibold text-left">En</th>
                <th className="px-4 py-3 font-semibold text-left">Probabilidad</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? "bg-white" : "bg-emerald-50"}>
                  <td className="px-4 py-3">{row.fecha}</td>
                  <td className="px-4 py-3 font-bold text-emerald-700">{row.cama_id}</td>
                  <td className="px-4 py-3">{row.habitacion_id}</td>
                  <td className="px-4 py-3">{row.proxima_salida_paciente}</td>
                  <td className="px-4 py-3">{formatHora(row.hora_salida)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded bg-emerald-200 text-emerald-900 font-semibold">{row.probabilidad}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
