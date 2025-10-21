"use client";
import useSWR from "swr";

import { Bed, Patient, PatientHistory, Room } from "@/types";
import { to12HourWithDate } from "@/utils/time";

export default function BedStatusBoard() {
  const { data: bedsData } = useSWR<Bed[]>("/api/beds");
  const { data: roomsData } = useSWR<Room[]>("/api/rooms");
  const { data: patientsData } = useSWR<Patient[]>("/api/patients");
  const { data: historyData } = useSWR<PatientHistory[]>("/api/patient_history");

  // ensure arrays (avoid { error: ... } breaking .map/.filter)
  const beds = Array.isArray(bedsData)
    ? bedsData.slice().sort((a, b) => new Date(String(b.last_update)).getTime() - new Date(String(a.last_update)).getTime())
    : [];
  const rooms = Array.isArray(roomsData) ? roomsData : [];
  const patients = Array.isArray(patientsData) ? patientsData : [];
  const history = Array.isArray(historyData) ? historyData : [];

  const getRoomNumber = (room_id: number) =>
    rooms.find((r) => r.id === room_id)?.number ?? room_id;

  // Handler para guardar historial (solo texto, ejemplo)
  const handleSaveHistory = async (patientId: number, tipo: "texto" | "audio", contenido: string) => {
    await fetch("/api/patient_history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient_id: patientId, tipo, contenido }),
    });
  };

  // helper: obtener texto combinado de diagnóstico/procedimiento
  const getPatientDiagnostics = (p?: Patient) => {
    if (!p) return "—";
    const combined = p.diagnosticos_procedimientos?.trim();
    if (combined && combined !== "") return combined;
    const parts: string[] = [];
    if (p.diagnostico?.trim()) parts.push(p.diagnostico.trim());
    if (p.procedimiento?.trim()) parts.push(p.procedimiento.trim());
    return parts.length ? parts.join(" | ") : "—";
  };

  return (
    <section className="rounded-xl p-6 text-white shadow">
      <h3 className="text-xl font-bold mb-4">Estado de Camas</h3>
      <div className="overflow-x-auto rounded">
        <table className="w-full text-white table-auto">
          <thead className="bg-gray-50/10">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Cama</th>
              <th className="px-4 py-3 text-left font-semibold">Habitación</th>
              <th className="px-4 py-3 text-left font-semibold">Estado</th>
              <th className="px-4 py-3 text-left font-semibold">Última actualización</th>
              <th className="px-4 py-3 text-left font-semibold">Diagnóstico / Proced.</th>
              <th className="px-4 py-3 text-left font-semibold">Egreso</th>
              <th className="px-4 py-3 text-left font-semibold">Historial</th>
            </tr>
          </thead>
          <tbody className="divide-y ">
            {beds.map((bed) => {
              const patient = patients.find((p) => p.bed_id === bed.id);
              const patientId = patient?.id;
              const patientHistory = history.filter((h) => h.patient_id === patientId);
              return (
                <tr key={bed.id}>
                  <td className="px-4 py-3 align-top">{bed.id}</td>
                  <td className="px-4 py-3 align-top">{getRoomNumber(bed.room_id)}</td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={`px-2 py-1 rounded ${bed.status === "Disponible"
                        ? "bg-green-600"
                        : bed.status === "Limpieza"
                          ? "bg-yellow-500 text-white"
                          : bed.status === "Ocupada"
                            ? "bg-red-600"
                            : bed.status === "Mantenimiento"
                              ? "bg-gray-500"
                              : bed.status === "Aislamiento"
                                ? "bg-blue-800"
                                : bed.status === "Reserva"
                                  ? "bg-purple-600"
                                  : "bg-blue-600"
                        }`}
                    >
                      {bed.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">{to12HourWithDate(bed.last_update)}</td>
                  <td className="px-4 py-3 align-top">{getPatientDiagnostics(patient)}</td>
                  <td className="px-4 py-3 align-top">{patient?.pre_egreso ?? "—"}</td>
                  <td className="px-4 py-3 align-top">
                    {patientId && (
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="Agregar historial..."
                          className="text-black px-2 py-1 rounded"
                          onKeyDown={async (e) => {
                            if (e.key === "Enter" && e.currentTarget.value) {
                              await handleSaveHistory(patientId, "texto", e.currentTarget.value);
                              e.currentTarget.value = "";
                            }
                          }}
                        />
                        {/* Mostrar historial reciente */}
                        <div className="max-h-20 overflow-y-auto text-xs">
                          {patientHistory.slice(-3).map((h) => (
                            <div key={h.id}>
                              <span className="font-bold">[{new Date(h.fecha).toLocaleString()}]</span> {h.tipo === "audio" ? "[Audio]" : h.contenido}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
