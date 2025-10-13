"use client";
import { useEffect, useState } from "react";

interface Egress {
  patient: string;
  bedId: number;
  status: "En Proceso" | "Completado" | "Pendiente";
  expectedTime: string;
}

export default function EgressTracker() {
  const [egresses, setEgresses] = useState<Egress[]>([]);

  useEffect(() => {
    // TODO: fetch egress data from API route
    setEgresses([
      { patient: "Juan Pérez", bedId: 1, status: "En Proceso", expectedTime: "13:30" },
      { patient: "Ana Gómez", bedId: 3, status: "Pendiente", expectedTime: "14:00" },
    ]);
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
          {egresses.map((egress, idx) => (
            <tr key={idx}>
              <td>{egress.patient}</td>
              <td>{egress.bedId}</td>
              <td>
                <span
                  className={`px-2 py-1 rounded ${egress.status === "Completado"
                      ? "bg-green-600"
                      : egress.status === "En Proceso"
                        ? "bg-blue-600"
                        : "bg-yellow-500"
                    }`}
                >
                  {egress.status}
                </span>
              </td>
              <td>{egress.expectedTime}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
