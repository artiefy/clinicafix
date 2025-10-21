"use client";
import useSWR from "swr";

import { Bed, Discharge, Patient, Room } from "@/types";
import { to12HourWithDate } from "@/utils/time";

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
    <section className="bg-white/10 rounded-xl p-6 text-white shadow">
      <h3 className="text-xl font-bold mb-4">Salidas De Pacientes</h3>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col style={{ width: "6%" }} />
            <col style={{ width: "30%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "16%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className="px-2 py-1">#</th>
              <th className="px-2 py-1">Paciente</th>
              <th className="px-2 py-1">Cama</th>
              <th className="px-2 py-1">Habitación</th>
              <th className="px-2 py-1">Hora de Entrada</th>
              <th className="px-2 py-1">Hora De Salida</th>
              <th className="px-2 py-1">Tiempo en clínica</th>
            </tr>
          </thead>
          <tbody>
            {disList.map((discharge, idx) => {
              const patient = patientList.find((p) => p.name === discharge.patient);
              const adm = getAdmissionDateTime(patient, discharge);
              const out = discharge.expected_time ? new Date(String(discharge.expected_time)) : null;
              const durMs = adm && out ? Math.max(0, out.getTime() - adm.getTime()) : 0;
              return (
                <tr key={discharge.id}>
                  <td className="px-2 py-1 text-xs">{idx + 1}</td>
                  <td className="px-2 py-1 truncate">{discharge.patient}</td>
                  <td className="px-2 py-1 text-xs">{discharge.bed_id}</td>
                  <td className="px-2 py-1 text-xs">{getRoomNumberForBed(discharge.bed_id)}</td>
                  <td className="px-2 py-1">{adm ? to12HourWithDate(adm) : "—"}</td>
                  <td className="px-2 py-1">{out ? to12HourWithDate(out) : "—"}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{durMs > 0 ? formatDuration(durMs) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
