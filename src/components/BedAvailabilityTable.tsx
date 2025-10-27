"use client";
import useSWR from "swr";

import { BedAvailabilityPrediction } from "@/types";
import { to12Hour } from "@/utils/time";

export default function BedAvailabilityTable() {
  const { data: hourlyRaw } = useSWR<BedAvailabilityPrediction[]>("/api/bed_availability_predictions?tipo=hora");
  const { data: dailyRaw } = useSWR<BedAvailabilityPrediction[]>("/api/bed_availability_predictions?tipo=dia");

  const hourly: BedAvailabilityPrediction[] = Array.isArray(hourlyRaw) ? hourlyRaw : [];
  const daily: BedAvailabilityPrediction[] = Array.isArray(dailyRaw) ? dailyRaw : [];

  // Agrupa por fecha para la tabla diaria (sumando camas por fecha)
  const dailyGrouped = daily.reduce((acc, curr) => {
    if (!acc[curr.fecha]) acc[curr.fecha] = { camas: 0, probabilidad: 0, habitaciones: [] as number[] };
    acc[curr.fecha].camas += curr.camas_disponibles;
    acc[curr.fecha].probabilidad += curr.probabilidad;
    acc[curr.fecha].habitaciones.push(curr.room_id);
    return acc;
  }, {} as Record<string, { camas: number; probabilidad: number; habitaciones: number[] }>);

  return (
    <div className="card bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200 p-6">
      <h3 className="card-title mb-6 text-2xl font-bold text-center bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
        Disponibilidad de camas
      </h3>

      {/* Tabla por hora */}
      <div className="mb-8">
        <h4 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <span className="w-3 h-3 bg-blue-500 rounded-full" />
          Por hora (hoy)
        </h4>
        <div className="overflow-x-auto rounded-lg shadow-md">
          <table className="w-full table-auto bg-white border-collapse">
            <thead>
              <tr className="bg-indigo-600/70 text-white shadow-lg">
                <th className="px-6 py-4 text-left font-bold rounded-tl-lg border-b-2 border-indigo-700">Hora</th>
                <th className="px-6 py-4 text-left font-bold border-b-2 border-indigo-700">Camas disponibles</th>
                <th className="px-6 py-4 text-left font-bold border-b-2 border-indigo-700">Habitación</th>
                <th className="px-6 py-4 text-left font-bold rounded-tr-lg border-b-2 border-indigo-700">Probabilidad</th>
              </tr>
            </thead>
            <tbody>
              {hourly.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500 italic rounded-b-lg">
                    No hay datos de disponibilidad por hora
                  </td>
                </tr>
              ) : (
                hourly.map((row, idx) => (
                  <tr key={row.hora} className={`hover:bg-blue-50 transition-colors duration-200 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                    <td className="px-6 py-4 font-medium text-gray-800">{to12Hour(row.hora)}</td>
                    <td className="px-6 py-4 text-gray-700">{row.camas_disponibles}</td>
                    <td className="px-6 py-4 text-gray-700">{row.habitaciones?.join(", ") ?? row.room_id}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${row.probabilidad > 0.8 ? 'bg-green-100 text-green-800' :
                        row.probabilidad > 0.5 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                        {(row.probabilidad * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabla por día */}
      <div>
        <h4 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <span className="w-3 h-3 bg-purple-500 rounded-full" />
          Próximos 5 días
        </h4>
        <div className="overflow-x-auto rounded-lg shadow-md">
          <table className="w-full table-auto bg-white border-collapse">
            <thead>
              <tr className="bg-teal-600/70 text-white shadow-lg">
                <th className="px-6 py-4 text-left font-bold rounded-tl-lg border-b-2 border-teal-700">Fecha</th>
                <th className="px-6 py-4 text-left font-bold border-b-2 border-teal-700">Camas disponibles</th>
                <th className="px-6 py-4 text-left font-bold border-b-2 border-teal-700">Habitaciones</th>
                <th className="px-6 py-4 text-left font-bold rounded-tr-lg border-b-2 border-teal-700">Probabilidad total</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(dailyGrouped).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500 italic rounded-b-lg">
                    No hay datos de disponibilidad por día
                  </td>
                </tr>
              ) : (
                Object.entries(dailyGrouped).map(([fecha, data], idx) => (
                  <tr key={fecha} className={`hover:bg-purple-50 transition-colors duration-200 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                    <td className="px-6 py-4 font-medium text-gray-800">{fecha}</td>
                    <td className="px-6 py-4 text-gray-700">{data.camas}</td>
                    <td className="px-6 py-4 text-gray-700">{data.habitaciones.join(", ")}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${data.probabilidad > 0.8 ? 'bg-green-100 text-green-800' :
                        data.probabilidad > 0.5 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                        {(data.probabilidad * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
