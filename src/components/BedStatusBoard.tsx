"use client";
import { AiOutlineCheckCircle } from "react-icons/ai";
import { FaStethoscope } from "react-icons/fa";
import { IoExitOutline } from "react-icons/io5";
import { MdMedicalServices, MdOutlineCleaningServices } from "react-icons/md";
import useSWR from "swr";

import { Bed, Room } from "@/types";
import { to12HourWithDate } from "@/utils/time";

export default function BedStatusBoard() {
  const { data: bedsData } = useSWR<Bed[]>("/api/beds");
  const { data: roomsData } = useSWR<Room[]>("/api/rooms");

  const beds = Array.isArray(bedsData)
    ? bedsData.slice().sort((a, b) => new Date(String(b.last_update)).getTime() - new Date(String(a.last_update)).getTime())
    : [];
  const rooms = Array.isArray(roomsData) ? roomsData : [];

  const getRoomNumber = (room_id: number) => rooms.find((r) => r.id === room_id)?.number ?? room_id;

  const statusClass = (s: string) => {
    switch (s) {
      case "Disponible":
        return "bg-green-600";
      case "Limpieza":
        return "bg-yellow-500 text-white";
      case "Atención Médica":
        return "bg-red-600";
      case "Diagnostico y Procedimiento":
        return "bg-blue-600";
      case "Pre-egreso":
        return "bg-amber-600 text-white";
      case "Mantenimiento":
        return "bg-gray-500";
      case "Aislamiento":
        return "bg-indigo-800";
      case "Reserva":
        return "bg-purple-600";
      default:
        return "bg-gray-600";
    }
  };

  return (
    <section className="card">
      <h3 className="card-title">Estado de Camas</h3>
      <div className="overflow-x-auto table-card">
        <table className="w-full table-fixed min-w-[600px] text-black">
          <colgroup>
            <col style={{ width: "20%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "30%" }} />
            <col style={{ width: "30%" }} />
          </colgroup>
          <thead className="bg-gray-50/10">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Cama</th>
              <th className="px-4 py-3 text-left font-semibold">Habitación</th>
              <th className="px-4 py-3 text-left font-semibold">Estado</th>
              <th className="px-4 py-3 text-left font-semibold">Última actualización</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {beds.map((bed) => (
              <tr key={bed.id} className="align-top">
                <td className={`px-4 py-3 align-top ${bed.status === "Disponible" ? "border-l-4 border-green-600 bg-green-100/80"
                  : bed.status === "Atención Médica" ? "border-l-4 border-red-600 bg-red-100/80"
                    : bed.status === "Diagnostico y Procedimiento" ? "border-l-4 border-blue-600 bg-blue-100/80"
                      : bed.status === "Pre-egreso" ? "border-l-4 border-amber-600 bg-amber-100/80"
                        : bed.status === "Limpieza" ? "border-l-4 border-yellow-500 bg-yellow-50"
                          : ""}
                }`}>{bed.id}</td>
                <td className={`px-4 py-3 align-top ${bed.status === "Disponible" ? "border-l-4 border-green-600 bg-green-100/80" : ""
                  }`}>{getRoomNumber(bed.room_id)}</td>
                <td className="px-4 py-3 align-top relative">
                  <span className={`px-2 py-1 rounded ${statusClass(bed.status)}`}>{bed.status}</span>
                  <span className="absolute bottom-2 right-2 text-xl opacity-85">
                    {bed.status === "Disponible" ? <AiOutlineCheckCircle className="text-green-600" />
                      : bed.status === "Limpieza" ? <MdOutlineCleaningServices className="text-yellow-600" />
                        : bed.status === "Atención Médica" ? <FaStethoscope className="text-red-600" />
                          : bed.status === "Diagnostico y Procedimiento" ? <MdMedicalServices className="text-blue-600" />
                            : bed.status === "Pre-egreso" ? <IoExitOutline className="text-amber-600" />
                              : null}
                  </span>
                </td>
                <td className="px-4 py-3 align-top">{to12HourWithDate(bed.last_update)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
