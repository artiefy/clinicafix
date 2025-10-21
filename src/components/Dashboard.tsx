"use client";

import React from "react";

import useSWR from "swr";

import { Bed, Discharge, Patient, Room } from "@/types";
import { to12HourWithDate } from "@/utils/time"; // <-- nuevo import

export default function Dashboard() {
  const { data: beds } = useSWR<Bed[]>("/api/dashboard");
  const { data: rooms } = useSWR<Room[]>("/api/rooms");
  // Nuevos: traer pacientes y egresos para mostrar diagnóstico/proced. y egreso
  const { data: patients } = useSWR<Patient[]>("/api/patients");
  const { data: discharges } = useSWR<Discharge[]>("/api/discharges");
  const bedsList = beds ?? [];
  const roomsList = rooms ?? [];
  const patientsList = patients ?? [];
  const dischargesList = discharges ?? [];

  const getRoomNumber = (room_id: number) =>
    roomsList.find((r) => r.id === room_id)?.number ?? room_id;

  // Helper: combinar diagnóstico/procedimiento (usa campo combinado si existe)
  const getPatientDiagnostics = (p?: Patient) => {
    if (!p) return "—";
    const combined = p.diagnosticos_procedimientos?.trim();
    if (combined && combined !== "") return combined;
    const parts: string[] = [];
    if (p.diagnostico?.trim()) parts.push(p.diagnostico.trim());
    if (p.procedimiento?.trim()) parts.push(p.procedimiento.trim());
    return parts.length ? parts.join(" | ") : "—";
  };

  // Helper: egreso (priorizar campo patient.egreso, fallback a latest discharge expected_time)
  const getPatientEgreso = (p?: Patient) => {
    if (!p) return "—";
    if (p.pre_egreso && p.pre_egreso.trim() !== "") return p.pre_egreso;
    // fallback: buscar discharge por nombre
    const match = dischargesList.filter((d) => d.patient === p.name).slice(-1)[0];
    if (match?.expected_time) return new Date(match.expected_time).toLocaleString();
    return "—";
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Estado de Camas desde la base de datos</h2>
      <div className="overflow-hidden rounded shadow">
        <table className="w-full bg-white text-black table-auto">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">ID</th>
              <th className="px-4 py-3 text-left font-semibold">Habitación</th>
              <th className="px-4 py-3 text-left font-semibold">Estado</th>
              <th className="px-4 py-3 text-left font-semibold">Diagnóstico / Proced.</th>
              <th className="px-4 py-3 text-left font-semibold">Egreso</th>
              <th className="px-4 py-3 text-left font-semibold">Última actualización</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {bedsList.map((bed) => (
              <tr key={bed.id} className="last:pb-4">
                <td className="px-4 py-3 align-top">{bed.id}</td>
                <td className="px-4 py-3 align-top">{getRoomNumber(bed.room_id)}</td>
                <td className="px-4 py-3 align-top">{bed.status}</td>
                {/* Buscar paciente asignado para mostrar diagnóstico/proced. y egreso */}
                {(() => {
                  const patient = patientsList.find((pt) => pt.bed_id === bed.id);
                  return (
                    <>
                      <td className="px-4 py-3 align-top">{getPatientDiagnostics(patient)}</td>
                      <td className="px-4 py-3 align-top">{getPatientEgreso(patient)}</td>
                    </>
                  );
                })()}
                <td className="px-4 py-3 align-top">{to12HourWithDate(bed.last_update)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
