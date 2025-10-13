"use client";
import { useEffect, useState } from "react";

interface Bed {
  id: number;
  status: "Disponible" | "Ocupada" | "Limpieza" | "Reservada";
  room: string;
  lastUpdate: string;
}

export default function BedStatusBoard() {
  const [beds, setBeds] = useState<Bed[]>([]);

  useEffect(() => {
    // TODO: fetch beds from API route
    // fetch("/api/beds").then(res => res.json()).then(setBeds);
    setBeds([
      { id: 1, status: "Disponible", room: "101", lastUpdate: "2024-06-10 13:00" },
      { id: 2, status: "Limpieza", room: "102", lastUpdate: "2024-06-10 12:45" },
      { id: 3, status: "Ocupada", room: "103", lastUpdate: "2024-06-10 11:30" },
    ]);
  }, []);

  return (
    <section className="bg-white/10 rounded-xl p-6 text-white shadow">
      <h3 className="text-xl font-bold mb-4">Estado de Camas</h3>
      <table className="w-full text-left">
        <thead>
          <tr>
            <th>Cama</th>
            <th>Habitación</th>
            <th>Estado</th>
            <th>Última actualización</th>
          </tr>
        </thead>
        <tbody>
          {beds.map((bed) => (
            <tr key={bed.id}>
              <td>{bed.id}</td>
              <td>{bed.room}</td>
              <td>
                <span
                  className={`px-2 py-1 rounded ${bed.status === "Disponible"
                      ? "bg-green-600"
                      : bed.status === "Limpieza"
                        ? "bg-yellow-500"
                        : bed.status === "Ocupada"
                          ? "bg-red-600"
                          : "bg-blue-600"
                    }`}
                >
                  {bed.status}
                </span>
              </td>
              <td>{bed.lastUpdate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
