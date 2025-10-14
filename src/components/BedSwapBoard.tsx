"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

import { Bed, Patient, Room } from "@/types";

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const STATUS: ("Limpieza" | "Disponible" | "Ocupada")[] = [
  "Limpieza",
  "Disponible",
  "Ocupada",
];

// Helper: mueve un elemento identificado por id al inicio del grupo target (por status)
function moveBedToStatusFront(bedsArr: Bed[], bedId: number, targetStatus: string) {
  // crear nuevo array sin el bed movido
  const other = bedsArr.filter((b) => b.id !== bedId);
  // encontrar el bed
  const moved = bedsArr.find((b) => b.id === bedId);
  if (!moved) return bedsArr;
  // actualizar status localmente
  const updated = { ...moved, status: targetStatus };
  // insertar al inicio
  return [updated, ...other];
}

// Helper: mueve paciente al inicio del listado (por estado sin cama / de alta)
function movePatientToFront(patientsArr: Patient[], patientId: number, newFields: Partial<Patient>) {
  const other = patientsArr.filter((p) => p.id !== patientId);
  const moved = patientsArr.find((p) => p.id === patientId);
  if (!moved) return patientsArr;
  const updated = { ...moved, ...newFields };
  return [updated, ...other];
}

export default function BedSwapBoard() {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);

  // dragging state: { type: 'bed' | 'patient' | null, id?: number }
  // prefix with underscore to avoid "assigned but never used" eslint
  const [_dragging, setDragging] = useState<{ type: "bed" | "patient" | null; id?: number }>({ type: null });
  const [hoverStatus, setHoverStatus] = useState<string | null>(null);

  // memoized fetchAll so callbacks can depend on it safely
  const fetchAll = useCallback(async () => {
    try {
      const [bedsRes, roomsRes, patientsRes] = await Promise.all([
        fetch("/api/beds"),
        fetch("/api/rooms"),
        fetch("/api/patients"),
      ]);
      setBeds((await bedsRes.json()) as Bed[]);
      setRooms((await roomsRes.json()) as Room[]);
      setPatients((await patientsRes.json()) as Patient[]);
    } catch {
      setBeds([]);
      setRooms([]);
      setPatients([]);
    }
  }, []);

  // keep a ref to the latest fetchAll so callbacks can call it without adding it to deps
  const fetchAllRef = useRef(fetchAll);
  useEffect(() => {
    fetchAllRef.current = fetchAll;
  }, [fetchAll]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const getRoomNumber = (room_id: number) =>
    rooms.find((r) => r.id === room_id)?.number ?? room_id;

  // helpers that operate by ids (invocables desde Pragmatic callbacks)
  const assignPatientToBed = useCallback(async (patientId: number, bedId: number) => {
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bed_id: bedId, status: "con cama" }),
      });
      if (!res.ok) {
        console.error("PUT patient failed:", await res.text());
        return;
      }
      // call the latest fetchAll via ref to avoid adding fetchAll to deps
      await fetchAllRef.current?.();
    } catch (err) {
      console.error("Error assigning patient:", err);
    } finally {
      setHoverStatus(null);
      setDragging({ type: null });
    }
  }, []);

  const changeBedStatusById = useCallback(async (bedId: number, status: "Disponible" | "Limpieza" | "Ocupada") => {
    // Prevent manual moving into Ocupada; occupancy must be done by assigning a patient
    if (status === "Ocupada") {
      console.warn("No se puede mover manualmente a 'Ocupada'. Asigne un paciente para ocupar la cama.");
      setHoverStatus(null);
      setDragging({ type: null });
      return;
    }
    // local validation: don't allow changing from occupied if patient active
    const assigned = patients.find((p) => p.bed_id === bedId);
    if (assigned && assigned.discharge_status !== "de alta") {
      console.warn("No se puede cambiar el estado: la cama tiene un paciente activo.");
      setHoverStatus(null);
      setDragging({ type: null });
      return;
    }

    try {
      const res = await fetch(`/api/beds/${bedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        console.error("PUT bed failed:", await res.text());
        return;
      }
      setBeds((prev) => moveBedToStatusFront(prev, bedId, status));
    } catch (err) {
      console.error("Error updating bed status:", err);
    } finally {
      setHoverStatus(null);
      setDragging({ type: null });
    }
  }, [patients]);

  const updatePatientStatusById = useCallback(
    async (patientId: number, targetStatus: "sin cama" | "de alta") => {
      // read current patient to know previous bed (if any)
      const current = patients.find((p) => p.id === patientId);
      const prevBedId = current?.bed_id ?? null;

      try {
        const body = targetStatus === "sin cama" ? { status: targetStatus, bed_id: null } : { status: targetStatus };
        const res = await fetch(`/api/patients/${patientId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          console.error("PUT patient failed:", await res.text());
          return;
        }

        // update local patient ordering/state
        if (targetStatus === "sin cama") {
          setPatients((prev) => movePatientToFront(prev, patientId, { bed_id: null, discharge_status: "sin cama" }));
          // if patient left a bed, mark bed available locally
          if (prevBedId) {
            setBeds((prev) => prev.map((b) => (b.id === prevBedId ? { ...b, status: "Disponible" } : b)));
          }
        } else {
          // discharged: set patient status and free bed
          setPatients((prev) => movePatientToFront(prev, patientId, { discharge_status: "de alta", bed_id: null }));
          if (prevBedId) {
            // move that bed to "Limpieza" locally so it appears in the Limpieza column immediately
            setBeds((prev) => prev.map((b) => (b.id === prevBedId ? { ...b, status: "Limpieza" } : b)));
          }
          // OPTIONAL: if you prefer to refresh from server instead of local mutation,
          // use await fetchAll(); here to get authoritative state from backend.
        }
      } catch (err) {
        console.error("Error updating patient status:", err);
      } finally {
        setHoverStatus(null);
        setDragging({ type: null });
      }
    },
    [patients],
  );

  // Pragmatic integration: create draggables and dropTargets based on data-attributes
  useEffect(() => {
    const disposers: (() => void)[] = [];

    // create draggables for patients
    document.querySelectorAll<HTMLElement>("[data-draggable-patient]").forEach((el) => {
      const idAttr = el.dataset.draggablePatient;
      const patientId = idAttr ? Number(idAttr) : NaN;
      if (!Number.isFinite(patientId)) return;
      const disposer = draggable({
        element: el,
        getInitialData: () => ({ type: "patient", id: patientId }),
        onDragStart: () => setDragging({ type: "patient", id: patientId }),
        onDrop: () => {
          setDragging({ type: null });
          setHoverStatus(null);
        },
      });
      disposers.push(() => disposer?.());
    });

    // create draggables for beds (we allow dragging beds to change status)
    document.querySelectorAll<HTMLElement>("[data-draggable-bed]").forEach((el) => {
      const idAttr = el.dataset.draggableBed;
      const bedId = idAttr ? Number(idAttr) : NaN;
      if (!Number.isFinite(bedId)) return;
      const disposer = draggable({
        element: el,
        getInitialData: () => ({ type: "bed", id: bedId }),
        onDragStart: () => setDragging({ type: "bed", id: bedId }),
        onDrop: () => {
          setDragging({ type: null });
          setHoverStatus(null);
        },
      });
      disposers.push(() => disposer?.());
    });

    // drop targets: columns (Limpieza, Disponible, Ocupada) - accept bed drops and patient drops appropriately
    document.querySelectorAll<HTMLElement>("[data-drop-column]").forEach((el) => {
      const status = el.dataset.dropColumn!;
      if (!status) return;
      const disposer = dropTargetForElements({
        element: el,
        // Only show the top-column placeholder when dragging a BED (changing bed status).
        // When dragging a PATIENT we won't set a column placeholder; patient drops are handled on bed cards.
        onDragEnter: ({ source }) => {
          if (source?.data?.type !== "bed") return;
          if (status === "Ocupada") return; // don't show placeholder for Ocupada when dragging beds
          setHoverStatus(status);
        },
        onDragLeave: () => {
          setHoverStatus(null);
        },
        onDrop: ({ source }) => {
          // source.data has { type, id }
          if (!source?.data) {
            setHoverStatus(null);
            return;
          }
          if (source.data.type === "bed") {
            const bedId = source.data.id as number;
            // avoid manual move into Ocupada
            // also ignore bed drops on the "de alta" column — only patients may be discharged
            if (status === "Ocupada" || status === "de alta") {
              setHoverStatus(null);
              setDragging({ type: null });
              return;
            }
            void changeBedStatusById(bedId, status as "Limpieza" | "Disponible" | "Ocupada");
          } else if (source.data.type === "patient") {
            const patientId = source.data.id as number;
            // drop into patient columns - only "sin cama" or "de alta" expected here
            if (status === "sin cama") {
              void updatePatientStatusById(patientId, "sin cama");
            } else if (status === "de alta") {
              void updatePatientStatusById(patientId, "de alta");
            } else {
              // ignore patient drop on bed-status columns (no top placeholder for patients)
            }
          }
          setHoverStatus(null);
          setDragging({ type: null });
        },
      });
      disposers.push(() => disposer?.());
    });

    // drop targets: bed cards to accept patient drops
    document.querySelectorAll<HTMLElement>("[data-drop-bed]").forEach((el) => {
      const idAttr = el.dataset.dropBed;
      const bedId = idAttr ? Number(idAttr) : NaN;
      if (!Number.isFinite(bedId)) return;
      const disposer = dropTargetForElements({
        element: el,
        onDragEnter: ({ source }) => {
          // highlight only if dragging a PATIENT and the target bed is AVAILABLE
          if (source?.data?.type === "patient") {
            const targetBed = beds.find((b) => b.id === bedId);
            if (targetBed?.status === "Disponible") {
              setHoverStatus(`bed-${bedId}`);
            }
          }
        },
        onDragLeave: () => {
          setHoverStatus(null);
        },
        onDrop: ({ source }) => {
          // Only allow assigning patient when bed is Disponible
          if (source?.data?.type === "patient") {
            const patientId = source.data.id as number;
            const targetBed = beds.find((b) => b.id === bedId);
            if (targetBed?.status === "Disponible") {
              void assignPatientToBed(patientId, bedId);
            } else {
              // ignore drop to non-disponible bed
            }
          }
          setHoverStatus(null);
          setDragging({ type: null });
        },
      });
      disposers.push(() => disposer?.());
    });

    return () => {
      disposers.forEach((d) => d());
    };
  }, [beds, patients, assignPatientToBed, changeBedStatusById, updatePatientStatusById]); // rebind when data or callbacks change

  // Group beds by status
  const statusGroups: Record<string, Bed[]> = { Limpieza: [], Disponible: [], Ocupada: [] };
  beds.forEach((b: Bed) => {
    if (statusGroups[b.status]) statusGroups[b.status].push(b);
  });

  // Render: remove native drag event attributes; add data-attrs for Pragmatic
  return (
    <div>
      <h3 className="text-xl font-bold mb-4">Gestión de Pacientes y Camas</h3>

      <div className="grid grid-cols-1 gap-4 w-full">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 w-full">
          {/* Unassigned patients column */}
          <div className="col-span-1 bg-white/10 rounded-lg p-4 min-h-[220px] flex flex-col" data-drop-column="sin cama">
            <h4 className="font-semibold mb-2 text-center">Pacientes (sin cama)</h4>
            <div className="flex-1">
              {hoverStatus === "sin cama" ? <div className="h-6 border-2 border-dashed border-white/20 rounded mb-2 transition-all duration-200" /> : null}
              {patients
                .filter((p) => !p.bed_id && p.discharge_status === "sin cama")
                .map((p) => (
                  <div
                    key={p.id}
                    data-draggable-patient={String(p.id)}
                    className="mb-2 bg-white/20 rounded shadow p-2 transition-all duration-300 ease-in-out transform-gpu will-change-transform"
                  >
                    <div className="font-bold">{p.name}</div>
                    <div className="text-xs">Ingreso estimado: {p.estimated_time ?? "—"}</div>
                    <div className="text-xs">Estado: {p.discharge_status}</div>
                  </div>
                ))}
            </div>
          </div>

          {/* Beds columns */}
          <div className="col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            {STATUS.map((status) => (
              <div key={status} className="bg-white/10 rounded-lg p-4 min-h-[220px]" data-drop-column={status}>
                <h4 className="font-semibold mb-2 text-center">{status}</h4>
                <div className="flex-1">
                  {hoverStatus === status ? <div className="h-6 border-2 border-dashed border-white/20 rounded mb-2 transition-all duration-200" /> : null}
                  {statusGroups[status].map((bed: Bed) => {
                    const assigned = patients.find((p) => p.bed_id === bed.id);
                    const hasActivePatient = Boolean(assigned && assigned.discharge_status !== "de alta");
                    const isBedHighlight = hoverStatus === `bed-${bed.id}`;

                    return (
                      <div
                        key={bed.id}
                        data-draggable-bed={String(bed.id)}
                        data-drop-bed={String(bed.id)}
                        className={`mb-2 rounded shadow p-2 transition-all duration-300 ease-in-out transform-gpu will-change-transform ${isBedHighlight ? "ring-2 ring-sky-400 bg-sky-900/30" : ""} ${bed.status === "Disponible"
                          ? "bg-green-600/10 border-l-4 border-green-600"
                          : bed.status === "Limpieza"
                            ? "bg-yellow-500/10 border-l-4 border-yellow-500 text-white"
                            : "bg-red-600/10 border-l-4 border-red-600"
                          }`}
                      >
                        <div>
                          <span className="font-bold">Cama {bed.id}</span> - Hab. {getRoomNumber(bed.room_id)}
                        </div>
                        <div className="text-xs">Última actualización: {formatDate(bed.last_update)}</div>

                        {hasActivePatient ? <div className="mt-2 text-xs text-yellow-300">Bloqueada (paciente activo)</div> : null}

                        {assigned ? (
                          <div
                            className="mt-2 bg-white/5 p-2 rounded transition-all duration-300"
                            // make the small patient card draggable so only it can be dragged to "de alta"
                            data-draggable-patient={String(assigned.id)}
                          >
                            <div className="font-medium">{assigned.name}</div>
                            <div className="text-xs">Estado: {assigned.discharge_status}</div>
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-gray-300">Sin paciente</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Discharged column */}
          <div className="col-span-1 bg-white/10 rounded-lg p-4 min-h-[220px] flex flex-col" data-drop-column="de alta">
            <h4 className="font-semibold mb-2 text-center">Pacientes dados de alta</h4>
            <div className="flex-1">
              {hoverStatus === "de alta" ? <div className="h-6 border-2 border-dashed border-white/20 rounded mb-2 transition-all duration-200" /> : null}
              {patients.filter((p) => p.discharge_status === "de alta").map((p) => (
                <div key={p.id} className="mb-2 bg-white/20 rounded shadow p-2">
                  <div className="font-bold">{p.name}</div>
                  <div className="text-xs">Ingreso estimado: {p.estimated_time ?? "—"}</div>
                  <div className="text-xs">Estado: {p.discharge_status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
