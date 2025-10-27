"use client";
import useSWR from "swr";

import { Bed, Discharge, Patient, Room } from "@/types";
import { to12HourWithDate, to12HourWithDateShort } from "@/utils/time";

export default function EgressTracker() {
  const { data: discharges } = useSWR<Discharge[]>("/api/discharges");
  const { data: beds } = useSWR<Bed[]>("/api/beds");
  const { data: rooms } = useSWR<Room[]>("/api/rooms");
  const { data: patients } = useSWR<Patient[]>("/api/patients");

  // SWR devuelve undefined mientras carga; usar fallback vacío para render
  const disList = discharges ?? [];
  const bedList = beds ?? [];
  const roomList = rooms ?? [];
  const patientList = patients ?? [];

  // helper: derive admission Date from patient.estimated_time and discharge.expected_time
  const getAdmissionDateTime = (p?: Patient, discharge?: Discharge): Date | null => {
    if (!p || !discharge?.expected_time) return null;
    const dischargeDt = new Date(String(discharge.expected_time));
    // if estimated_time contains a date (YYYY-), parse directly
    const est = String(p.estimated_time ?? "").trim();
    if (!est) return null;
    if (/\d{4}-\d{2}-\d{2}/.test(est)) {
      const d = new Date(est);
      return isNaN(d.getTime()) ? null : d;
    }
    // assume est is time like HH:mm or HH:mm:ss, combine with discharge date
    const parts = est.split(":").map((n) => Number(n));
    if (parts.length >= 2) {
      const dt = new Date(dischargeDt);
      dt.setHours(parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, 0);
      // if constructed admission is after discharge, assume previous day
      if (dt > dischargeDt) dt.setDate(dt.getDate() - 1);
      return dt;
    }
    return null;
  };

  const formatDuration = (ms: number) => {
    if (!Number.isFinite(ms) || ms <= 0) return "—";
    const totalMin = Math.floor(ms / 60000);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return `${hours}h ${mins}m`;
  };

  // (removed aggregate total — solo se calcula la duración por fila en la renderización)
  const getRoomNumberForBed = (bedId: number | null | undefined) => {
    if (!bedId) return "—";
    const bed = bedList.find((b) => b.id === bedId);
    if (!bed) return "—";
    return roomList.find((r) => r.id === bed.room_id)?.number ?? bed.room_id ?? "—";
  };

  return (
    <section className="card shadow-lg rounded-xl bg-white/90 mt-8">
      <h3 className="card-title text-2xl font-bold mb-4 text-gray-800">Salidas De Pacientes</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] table-auto rounded-xl overflow-hidden text-black">
          <thead className="bg-gradient-to-r from-pink-100 via-pink-200 to-pink-100 text-pink-900">
            <tr>
              <th className="px-4 py-3 font-semibold text-left">#</th>
              <th className="px-4 py-3 font-semibold text-left">Paciente</th>
              <th className="px-4 py-3 font-semibold text-left">Cama</th>
              <th className="px-4 py-3 font-semibold text-left">Habitación</th>
              <th className="px-4 py-3 font-semibold text-left">Hora de Entrada</th>
              <th className="px-4 py-3 font-semibold text-left">Hora De Salida</th>
              <th className="px-4 py-3 font-semibold text-left">Tiempo en clínica</th>
            </tr>
          </thead>
          <tbody>
            {disList.map((discharge, idx) => {
              const patient = patientList.find((p) => p.name === discharge.patient);
              const adm = getAdmissionDateTime(patient, discharge);
              const out = discharge.expected_time ? new Date(String(discharge.expected_time)) : null;
              const durMs = adm && out ? Math.max(0, out.getTime() - adm.getTime()) : 0;
              return (
                <tr key={discharge.id} className={idx % 2 === 0 ? "bg-white" : "bg-pink-50"}>
                  <td className="px-4 py-3 text-xs">{idx + 1}</td>
                  <td className="px-4 py-3 font-bold text-pink-700">{discharge.patient}</td>
                  <td className="px-4 py-3 text-xs">{discharge.bed_id}</td>
                  <td className="px-4 py-3 text-xs">{getRoomNumberForBed(discharge.bed_id)}</td>
                  <td className="px-4 py-3">{adm ? to12HourWithDate(adm) : "—"}</td>
                  <td className="px-4 py-3">{adm ? to12HourWithDateShort(adm) : "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-1 rounded bg-pink-200 text-pink-900 font-semibold">{durMs > 0 ? formatDuration(durMs) : "—"}</span>
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
