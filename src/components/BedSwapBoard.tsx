"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

import { Bed, Discharge, Patient, Room } from "@/types"; // <-- añadí Discharge

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

// --- NEW: helper para ordenar camas por columna y por last_update (más reciente arriba) ---
function sortBeds(bedsArr: Bed[]) {
  const order: Record<string, number> = { Limpieza: 0, Disponible: 1, Ocupada: 2 };
  return [...bedsArr].sort((a, b) => {
    const ra = order[a.status] ?? 99;
    const rb = order[b.status] ?? 99;
    if (ra !== rb) return ra - rb;
    const ta = a.last_update ? new Date(a.last_update).getTime() : 0;
    const tb = b.last_update ? new Date(b.last_update).getTime() : 0;
    return tb - ta; // desc: más reciente primero (arriba)
  });
}

// Helper: mueve paciente al inicio del listado (por estado sin cama / de alta)
function movePatientToFront(patientsArr: Patient[], patientId: number, newFields: Partial<Patient>) {
  const other = patientsArr.filter((p) => p.id !== patientId);
  const moved = patientsArr.find((p) => p.id === patientId);
  if (!moved) return patientsArr;
  const updated = { ...moved, ...newFields };
  return [updated, ...other];
}

// --- ADD: tipos y type-guards para los datos de drag ---
interface PatientDragData {
  [key: string]: unknown; // index signature for compatibility
  type: "patient";
  id: number;
  rect?: DOMRect;
}
interface BedDragData {
  [key: string]: unknown;
  type: "bed";
  id: number;
  rect?: DOMRect;
}

// Remove unused DragData type

function isPatientDragData(x: unknown): x is PatientDragData {
  if (typeof x !== "object" || x === null) return false;
  const rec = x as Record<string, unknown>;
  return rec.type === "patient" && typeof rec.id === "number";
}

function isBedDragData(x: unknown): x is BedDragData {
  if (typeof x !== "object" || x === null) return false;
  const rec = x as Record<string, unknown>;
  return rec.type === "bed" && typeof rec.id === "number";
}

export default function BedSwapBoard() {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [discharges, setDischarges] = useState<Discharge[]>([]); // <-- nuevo estado
  // Cambia el tipo de recentDischarge para que incluya todas las propiedades de Patient y discharge_time
  type RecentDischargeType = Patient & { discharge_time: string };

  const [recentDischarge, setRecentDischarge] = useState<RecentDischargeType | null>(null);

  // dragging state: { type: 'bed' | 'patient' | null, id?: number }
  // prefix with underscore to avoid "assigned but never used" eslint
  const [_dragging, setDragging] = useState<{ type: "bed" | "patient" | null; id?: number }>({ type: null });
  const [hoverStatus, setHoverStatus] = useState<string | null>(null);
  const [placeholderHeight, setPlaceholderHeight] = useState<number | null>(null);
  const [bedPlaceholder, setBedPlaceholder] = useState<{ status: string; height: number } | null>(null);

  // Polling para actualizar en "tiempo real" (cada 8s)
  useEffect(() => {
    const id = setInterval(() => {
      fetchAllRef.current?.();
    }, 8000);
    return () => clearInterval(id);
  }, []);

  // fetchAll ahora incluye discharges
  const fetchAll = useCallback(async () => {
    try {
      const [bedsRes, roomsRes, patientsRes, dischargesRes] = await Promise.all([
        fetch("/api/beds"),
        fetch("/api/rooms"),
        fetch("/api/patients"),
        fetch("/api/discharges"),
      ]);
      setBeds((await bedsRes.json()) as Bed[]);
      setRooms((await roomsRes.json()) as Room[]);
      setPatients((await patientsRes.json()) as Patient[]);
      setDischarges((await dischargesRes.json()) as Discharge[]);
    } catch {
      setBeds([]);
      setRooms([]);
      setPatients([]);
      setDischarges([]);
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
    // Check if patient is already assigned to prevent re-assignment; only allow from unassigned patients
    const patient = patients.find((p) => p.id === patientId);
    if (patient?.bed_id) {
      console.warn("Cannot assign: patient is already assigned to a bed.");
      setHoverStatus(null);
      setDragging({ type: null });
      return;
    }

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
      // Optimistic UI update: asignar paciente localmente y marcar cama como Ocupada + timestamp,
      // luego reordenar por fecha (más reciente arriba en su columna)
      const now = new Date();
      setPatients((prev) => movePatientToFront(prev, patientId, { bed_id: bedId, discharge_status: "con cama" }));
      setBeds((prev) => sortBeds(prev.map((b) => (b.id === bedId ? { ...b, status: "Ocupada", last_update: now } : b))));
      // refrescar en background para sincronizar estado real
      fetchAllRef.current?.();
    } catch (err) {
      console.error("Error assigning patient:", err);
    } finally {
      setHoverStatus(null);
      setDragging({ type: null });
    }
  }, [patients]);

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
      // PUT para actualizar status y last_update en el backend
      const res = await fetch(`/api/beds`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bedId, status }),
      });
      if (!res.ok) {
        console.error("PUT bed failed:", await res.text());
        return;
      }
      // Actualiza estado y timestamp localmente y reordena por fecha (más reciente arriba)
      const now = new Date();
      setBeds((prev) =>
        sortBeds(
          prev.map((b) =>
            b.id === bedId && (status === "Disponible" || status === "Limpieza")
              ? { ...b, status: status, last_update: now }
              : b
          ),
        ),
      );
      fetchAllRef.current?.();
    } catch (err) {
      console.error("Error updating bed status:", err);
    } finally {
      setHoverStatus(null);
      setDragging({ type: null });
    }
  }, [patients]);

  const updatePatientStatusById = useCallback(
    async (patientId: number, targetStatus: "sin cama" | "de alta") => {
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

        if (targetStatus === "sin cama") {
          setPatients((prev) => movePatientToFront(prev, patientId, { bed_id: null, discharge_status: "sin cama" }));
          // if patient left a bed, mark bed available locally, update timestamp and reorder
          if (prevBedId) {
            const now = new Date();
            // Persist bed state change on server so last_update is saved there too
            await fetch("/api/beds", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: prevBedId, status: "Disponible" }),
            }).catch((err) => {
              console.warn("PUT /api/beds failed (mark Disponible):", err);
            });
            setBeds((prev) => sortBeds(prev.map((b) => (b.id === prevBedId ? { ...b, status: "Disponible", last_update: now } : b))));
          }
        } else {
          // discharged: set patient status and free bed
          setPatients((prev) => movePatientToFront(prev, patientId, { discharge_status: "de alta", bed_id: null }));
          if (prevBedId) {
            const now = new Date();
            await fetch("/api/beds", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: prevBedId, status: "Limpieza" }),
            }).catch((err) => {
              console.warn("PUT /api/beds failed (mark Limpieza):", err);
            });
            setBeds((prev) => sortBeds(prev.map((b) => (b.id === prevBedId ? { ...b, status: "Limpieza", last_update: now } : b))));
          }
          // Mutación local para mostrar el paciente dado de alta arriba de inmediato
          setRecentDischarge({
            ...(current!),
            discharge_time: new Date().toISOString(),
            discharge_status: "de alta",
            bed_id: null,
          });
          // Sincroniza después para mantener consistencia
          await fetchAllRef.current?.();
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
    // Elimina la variable 'draggingBedStatus' para evitar el warning de ESLint

    // create draggables for patients
    document.querySelectorAll<HTMLElement>("[data-draggable-patient]").forEach((el) => {
      const idAttr = el.dataset.draggablePatient;
      const patientId = idAttr ? Number(idAttr) : NaN;
      if (!Number.isFinite(patientId)) return;
      const disposer = draggable({
        element: el,
        // include rect so drop targets can render a preview with the same height
        getInitialData: ({ element }) => ({
          type: "patient",
          id: patientId,
          rect: element.getBoundingClientRect(),
        }),
        onDragStart: () => setDragging({ type: "patient", id: patientId }),
        onDrop: () => {
          setDragging({ type: null });
          setHoverStatus(null);
          setPlaceholderHeight(null);
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
        getInitialData: ({ element }) => ({
          type: "bed",
          id: bedId,
          rect: element.getBoundingClientRect(),
        }),
        onDragStart: () => {
          setDragging({ type: "bed", id: bedId });
          // (no guardar draggingBedStatus, no se usa)
        },
        onDrop: () => {
          setDragging({ type: null });
          setHoverStatus(null);
          setBedPlaceholder(null);
          // (no limpiar draggingBedStatus, no se usa)
        },
      });
      disposers.push(() => disposer?.());
    });

    // drop targets: columns (Limpieza, Disponible, Ocupada)
    document.querySelectorAll<HTMLElement>("[data-drop-column]").forEach((el) => {
      const status = el.dataset.dropColumn!;
      if (!status) return;
      const disposer = dropTargetForElements({
        element: el,
        onDragEnter: ({ source }) => {
          // Show placeholder for beds changing status (except to Ocupada)
          if (isBedDragData(source?.data)) {
            if (status === "Ocupada") return;
            setHoverStatus(status);
            // Only show preview for Disponible <-> Limpieza
            if (status === "Disponible" || status === "Limpieza") {
              const rectHeight = (source.data as BedDragData & { rect?: DOMRect }).rect?.height;
              setBedPlaceholder({ status, height: typeof rectHeight === "number" ? rectHeight : 56 });
            }
            return;
          }
          // Show placeholder for patients only when dragging to "de alta" column
          if (isPatientDragData(source?.data) && status === "de alta") {
            setHoverStatus(status);
            const rectHeight = source.data.rect?.height;
            setPlaceholderHeight(typeof rectHeight === "number" ? rectHeight : 48);
          }
        },
        // Mantener la sombra mientras se arrastra (no limpiar en onDragLeave)
        // onDragLeave: () => {
        //   setHoverStatus(null);
        //   setPlaceholderHeight(null);
        //   setBedPlaceholder(null);
        // },
        onDrop: ({ source }) => {
          if (!source?.data) {
            setHoverStatus(null);
            setPlaceholderHeight(null);
            setBedPlaceholder(null);
            return;
          }
          if (isBedDragData(source.data)) {
            const bedId = source.data.id;
            // Solo permitir mover entre Limpieza y Disponible
            if (status === "Disponible" || status === "Limpieza") {
              void changeBedStatusById(bedId, status as "Limpieza" | "Disponible");
            } else {
              setHoverStatus(null);
              setDragging({ type: null });
              setPlaceholderHeight(null);
              setBedPlaceholder(null);
              return;
            }
          } else if (isPatientDragData(source.data)) {
            const patientId = source.data.id;
            if (status === "sin cama") {
              void updatePatientStatusById(patientId, "sin cama");
            } else if (status === "de alta") {
              void updatePatientStatusById(patientId, "de alta");
            }
          }
          setHoverStatus(null);
          setDragging({ type: null });
          setPlaceholderHeight(null);
          setBedPlaceholder(null);
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
          // highlight only if dragging a PATIENT, the target bed is AVAILABLE, and the patient is unassigned
          if (source?.data?.type === "patient") {
            const patientId = source.data.id as number;
            const patient = patients.find((p) => p.id === patientId);
            const targetBed = beds.find((b) => b.id === bedId);
            if (targetBed?.status === "Disponible" && !patient?.bed_id) {
              setHoverStatus(`bed-${bedId}`);
            }
          }
        },
        onDragLeave: () => {
          setHoverStatus(null);
        },
        onDrop: ({ source }) => {
          // Only allow assigning patient when bed is Disponible and patient is unassigned
          if (source?.data?.type === "patient") {
            const patientId = source.data.id as number;
            const patient = patients.find((p) => p.id === patientId);
            const targetBed = beds.find((b) => b.id === bedId);
            if (targetBed?.status === "Disponible" && !patient?.bed_id) {
              void assignPatientToBed(patientId, bedId);
            } else {
              // ignore drop
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
  }, [beds, patients, assignPatientToBed, changeBedStatusById, updatePatientStatusById]);

  // Group beds by status, ordenando cada grupo por last_update descendente
  const statusGroups: Record<string, Bed[]> = {
    Limpieza: [],
    Disponible: [],
    Ocupada: [],
  };
  beds.forEach((b: Bed) => {
    if (statusGroups[b.status]) statusGroups[b.status].push(b);
  });
  // Ordenar cada grupo por last_update descendente (más reciente arriba)
  Object.keys(statusGroups).forEach((status) => {
    statusGroups[status] = statusGroups[status].slice().sort((a, b) => {
      const ta = a.last_update ? new Date(a.last_update).getTime() : 0;
      const tb = b.last_update ? new Date(b.last_update).getTime() : 0;
      return tb - ta;
    });
  });

  // --- Nuevo: calcular listas ordenadas para las columnas de pacientes ---

  // Pacientes sin cama: ordenar por estimated_time ascendente (hora de ingreso)
  const unassignedPatients = patients
    .filter((p) => !p.bed_id && p.discharge_status === "sin cama")
    .slice()
    .sort((a, b) => {
      // estimated_time puede ser null o "HH:MM:SS"
      const ta = a.estimated_time ?? "";
      const tb = b.estimated_time ?? "";
      if (!ta && !tb) return 0;
      if (!ta) return 1;
      if (!tb) return -1;
      // formato HH:MM:SS lexicográfico funciona
      return ta.localeCompare(tb);
    });

  // Pacientes dados de alta: ordenar por expected_time (discharges) descendente para que los más recientes queden arriba
  let dischargedPatients = patients
    .filter((p) => p.discharge_status === "de alta")
    .map((p) => {
      const matches = discharges.filter((d) => d.patient === p.name);
      let latest: string | Date | null = null;
      if (matches.length > 0) {
        latest = matches
          .map((m) => (m.expected_time ? new Date(m.expected_time).toISOString() : null))
          .filter(Boolean)
          .sort()
          .pop() ?? null;
      }
      return { ...p, discharge_time: latest };
    })
    .slice()
    .sort((a, b) => {
      const ta = a.discharge_time ? new Date(a.discharge_time).getTime() : 0;
      const tb = b.discharge_time ? new Date(b.discharge_time).getTime() : 0;
      return tb - ta;
    });

  // Si hay un alta reciente, insértala arriba de inmediato
  if (recentDischarge) {
    const alreadyExists = dischargedPatients.some((p) => p.id === recentDischarge.id);
    if (!alreadyExists) {
      dischargedPatients = [
        recentDischarge,
        ...dischargedPatients,
      ];
    }
  }

  // Render: remove native drag event attributes; add data-attrs for Pragmatic
  return (
    <div>
      <h3 className="text-xl font-bold mb-4">Gestión de Pacientes y Camas</h3>
      <div className="grid grid-cols-1 gap-4 w-full">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 w-full">
          {/* Unassigned patients */}
          <div className="col-span-1 bg-white/10 rounded-lg p-4 min-h-[220px] flex flex-col" data-drop-column="sin cama">
            <h4 className="font-semibold mb-2 text-center">
              Pacientes (sin cama)  {unassignedPatients.length}
            </h4>
            <div className="flex-1">
              {hoverStatus === "sin cama" ? <div className="h-6 border-2 border-dashed border-white/20 rounded mb-2 transition-all duration-200" /> : null}
              {unassignedPatients.map((p) => (
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
          {/* Beds columns (span 3 columns) */}
          <div className="col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            {STATUS.map((status) => (
              <div
                key={status}
                className="bg-white/10 rounded-lg p-4 min-h-[220px]"
                data-drop-column={status}
              >
                <h4 className="font-semibold mb-2 text-center">{status}</h4>
                <div className="flex-1">
                  {/* Bed drag preview for Disponible <-> Limpieza */}
                  {bedPlaceholder && hoverStatus === status && (status === "Disponible" || status === "Limpieza") ? (
                    <div
                      className={`mb-2 rounded shadow p-2 transition-all duration-200 will-change-transform
                        ${status === "Disponible"
                          ? "bg-green-600/10 border-l-4 border-green-600"
                          : "bg-yellow-500/10 border-l-4 border-yellow-500 text-white"
                        }`}
                      style={{ height: bedPlaceholder.height }}
                    />
                  ) : null}
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
                            data-draggable-patient={typeof assigned.id === "number" ? String(assigned.id) : undefined}
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
          {/* Discharged / Egresos column */}
          <div className="col-span-1 bg-white/10 rounded-lg p-4 min-h-[220px] flex flex-col" data-drop-column="de alta">
            <h4 className="font-semibold mb-2 text-center">Pacientes dados de alta</h4>
            <div className="flex-1">
              {/* Placeholder: use same color & padding as patient cards and match dragged rect height */}
              {hoverStatus === "de alta" ? (
                <div
                  className="mb-2 bg-white/20 rounded shadow p-2 transition-all duration-200"
                  style={placeholderHeight ? { height: `${placeholderHeight}px` } : undefined}
                />
              ) : null}
              {dischargedPatients.map((p: Patient & { discharge_time?: string | null }) => (
                <div key={p.id} className="mb-2 bg-white/20 rounded shadow p-2">
                  <div className="font-bold">{p.name}</div>
                  <div className="text-xs">
                    Hora de salida: {p.discharge_time ? formatDate(p.discharge_time) : "—"}
                  </div>
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
