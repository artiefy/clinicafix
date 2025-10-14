"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import useSWR, { useSWRConfig } from "swr";

import { Bed, Discharge, Patient, Room } from "@/types"; // <-- añadí Discharge
import { to12Hour, to12HourWithDate } from "@/utils/time"; // <-- nuevo import (se añade to12Hour)

function formatDate(date: Date | string | null | undefined) {
  // reutilizamos util consistente que devuelve "YYYY-MM-DD h:mm AM/PM"
  return to12HourWithDate(date);
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
  const { mutate } = useSWRConfig();
  const { data: bedsData } = useSWR<Bed[]>("/api/beds");
  const { data: roomsData } = useSWR<Room[]>("/api/rooms");
  const { data: patientsData } = useSWR<Patient[]>("/api/patients");
  const { data: dischargesData } = useSWR<Discharge[]>("/api/discharges");

  const [beds, setBeds] = useState<Bed[]>(bedsData ?? []);
  const [rooms, setRooms] = useState<Room[]>(roomsData ?? []);
  const [patients, setPatients] = useState<Patient[]>(patientsData ?? []);
  const [discharges, setDischarges] = useState<Discharge[]>(dischargesData ?? []);

  // Cambia el tipo de recentDischarge para que incluya todas las propiedades de Patient y discharge_time
  type RecentDischargeType = Patient & { discharge_time: string };

  const [recentDischarge, setRecentDischarge] = useState<RecentDischargeType | null>(null);

  // dragging state: { type: 'bed' | 'patient' | null, id?: number }
  const [_dragging, setDragging] = useState<{ type: "bed" | "patient" | null; id?: number }>({ type: null });

  // Ref to always have the latest dragging info inside event callbacks
  const draggingRef = useRef<{ type: "bed" | "patient" | null; id?: number }>(_dragging);
  useEffect(() => {
    draggingRef.current = _dragging;
  }, [_dragging]);

  const [hoverStatus, setHoverStatus] = useState<string | null>(null);
  const [placeholderHeight, setPlaceholderHeight] = useState<number | null>(null);
  const [bedPlaceholder, setBedPlaceholder] = useState<{ status: string; height: number } | null>(null);

  // Nuevas columnas permitidas durante el "press/drag" para iluminar destinos válidos
  const [allowedColumns, setAllowedColumns] = useState<string[]>([]);
  // ID de la primera cama Disponible a resaltar mientras se arrastra un paciente "sin cama"
  const [highlightBedId, setHighlightBedId] = useState<number | null>(null);

  // NOTE: polling removed. SWR provides the data (bedsData/roomsData/etc.)
  // and mutate(...) is used to revalidate after mutations to avoid repeated GETs.

  // --- NEW: refs para preview flotante y handlers de pointer ---
  const dragPreviewRef = useRef<HTMLElement | null>(null);
  const pointerMoveHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);
  const pointerUpHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);
  const currentDraggedElRef = useRef<HTMLElement | null>(null);

  // sync local state with SWR responses
  useEffect(() => {
    if (bedsData) setBeds(bedsData);
  }, [bedsData]);
  useEffect(() => {
    if (roomsData) setRooms(roomsData);
  }, [roomsData]);
  useEffect(() => {
    if (patientsData) setPatients(patientsData);
  }, [patientsData]);
  useEffect(() => {
    if (dischargesData) setDischarges(dischargesData);
  }, [dischargesData]);

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
      // revalidate SWR cache after mutation (invalidate affected keys)
      void mutate("/api/patients");
      void mutate("/api/beds");
      void mutate("/api/discharges");
      void mutate("/api/rooms");
    } catch (err) {
      console.error("Error assigning patient:", err);
    } finally {
      setHoverStatus(null);
      setDragging({ type: null });
    }
  }, [patients, mutate]);

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
      // revalidate beds & related caches
      void mutate("/api/beds");
      void mutate("/api/rooms");
      void mutate("/api/patients");
    } catch (err) {
      console.error("Error updating bed status:", err);
    } finally {
      setHoverStatus(null);
      setDragging({ type: null });
    }
  }, [patients, mutate]);

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
          // revalidate affected resources after discharge
          void mutate("/api/patients");
          void mutate("/api/beds");
          void mutate("/api/discharges");
          void mutate("/api/rooms");
        }
      } catch (err) {
        console.error("Error updating patient status:", err);
      } finally {
        setHoverStatus(null);
        setDragging({ type: null });
      }
    },
    [patients, mutate],
  );

  // Pragmatic integration: create draggables and dropTargets based on data-attributes
  useEffect(() => {
    const disposers: (() => void)[] = [];

    // create draggables for patients
    document.querySelectorAll<HTMLElement>("[data-draggable-patient]").forEach((el) => {
      const idAttr = el.dataset.draggablePatient;
      const patientId = idAttr ? Number(idAttr) : NaN;
      if (!Number.isFinite(patientId)) return;

      const createPreview = (element: HTMLElement) => {
        // remove any previous preview
        if (dragPreviewRef.current) {
          dragPreviewRef.current.remove();
          dragPreviewRef.current = null;
        }
        // asegurarse de iluminar columnas válidas si existe draggingRef.current
        // (siempre que se haya seteado allowedColumns en onDragStart)
        const rect = element.getBoundingClientRect();
        const clone = element.cloneNode(true) as HTMLElement;
        clone.classList.add("drag-preview");
        // prevent nested data attributes interfering
        clone.removeAttribute("data-draggable-patient");
        clone.removeAttribute("data-draggable-bed");
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        clone.style.position = "fixed";
        clone.style.left = `${rect.left}px`;
        clone.style.top = `${rect.top}px`;
        clone.style.zIndex = "9999";
        clone.style.pointerEvents = "none";
        document.body.appendChild(clone);
        dragPreviewRef.current = clone;

        // attach pointermove to follow pointer (preview slightly below pointer)
        const handler = (ev: PointerEvent) => {
          if (!dragPreviewRef.current) return;
          const w = dragPreviewRef.current.offsetWidth;
          const x = ev.clientX - w / 2;
          const y = ev.clientY + 10; // below the click
          dragPreviewRef.current.style.left = `${Math.max(4, x)}px`;
          dragPreviewRef.current.style.top = `${Math.max(4, y)}px`;
        };
        pointerMoveHandlerRef.current = handler;
        document.addEventListener("pointermove", handler);

        // attach pointerup / pointercancel to ensure cleanup when drag is cancelled
        const upHandler = () => {
          // call cleanup on the currently dragged element (if any)
          if (currentDraggedElRef.current) {
            // reuse same cleanup used in onDrop
            if (dragPreviewRef.current) {
              dragPreviewRef.current.remove();
              dragPreviewRef.current = null;
            }
            if (pointerMoveHandlerRef.current) {
              document.removeEventListener("pointermove", pointerMoveHandlerRef.current);
              pointerMoveHandlerRef.current = null;
            }
            // remove pointerup listeners
            if (pointerUpHandlerRef.current) {
              document.removeEventListener("pointerup", pointerUpHandlerRef.current);
              document.removeEventListener("pointercancel", pointerUpHandlerRef.current);
              pointerUpHandlerRef.current = null;
            }
            currentDraggedElRef.current.classList.remove("drag-hidden");
            currentDraggedElRef.current = null;
            // limpiar iluminación de columnas solo cuando se suelta (pointerup)
            setAllowedColumns([]);
            setHighlightBedId(null);
            setDragging({ type: null });
            setHoverStatus(null);
          }
        };
        pointerUpHandlerRef.current = upHandler;
        document.addEventListener("pointerup", upHandler);
        document.addEventListener("pointercancel", upHandler);
      };

      const removePreviewAndCleanup = (element?: HTMLElement) => {
        if (dragPreviewRef.current) {
          dragPreviewRef.current.remove();
          dragPreviewRef.current = null;
        }
        if (pointerMoveHandlerRef.current) {
          document.removeEventListener("pointermove", pointerMoveHandlerRef.current);
          pointerMoveHandlerRef.current = null;
        }
        if (pointerUpHandlerRef.current) {
          document.removeEventListener("pointerup", pointerUpHandlerRef.current);
          document.removeEventListener("pointercancel", pointerUpHandlerRef.current);
          pointerUpHandlerRef.current = null;
        }
        if (element) element.classList.remove("drag-hidden");
        currentDraggedElRef.current = null;
      };

      const disposer = draggable({
        element: el,
        getInitialData: ({ element }) => ({
          type: "patient",
          id: patientId,
          rect: element.getBoundingClientRect(),
        }),
        onDragStart: () => {
          // columnas válidas y cama resaltada segun el estado del paciente
          const p = patients.find((x) => x.id === patientId);
          if (p?.discharge_status === "sin cama") {
            // cuando el paciente está "sin cama" NO permitir "de alta"
            setAllowedColumns(["sin cama"]);
            // Resaltar la cama "Disponible" con last_update más reciente
            const mostRecentAvailable = beds
              .filter((b) => b.status === "Disponible")
              .slice()
              .sort((a, b) => {
                const ta = a.last_update ? new Date(a.last_update).getTime() : 0;
                const tb = b.last_update ? new Date(b.last_update).getTime() : 0;
                return tb - ta;
              })[0];
            setHighlightBedId(mostRecentAvailable ? mostRecentAvailable.id : null);
          } else {
            // paciente ya en cama o dado de alta: permitir ambos destinos
            setAllowedColumns(["sin cama", "de alta"]);
            setHighlightBedId(null);
          }
          setDragging({ type: "patient", id: patientId });
          // mark original as 'lifted' (attenuated)
          el.classList.add("drag-hidden");
          currentDraggedElRef.current = el;
          // create floating preview (clone) that will follow the pointer
          createPreview(el);
        },
        onDrop: () => {
          setAllowedColumns([]);
          setHighlightBedId(null);
          setDragging({ type: null });
          setHoverStatus(null);
          setPlaceholderHeight(null);
          removePreviewAndCleanup(el);
        },
      });
      disposers.push(() => disposer?.());
    });

    // create draggables for beds (we allow dragging beds to change status)
    document.querySelectorAll<HTMLElement>("[data-draggable-bed]").forEach((el) => {
      const idAttr = el.dataset.draggableBed;
      const bedId = idAttr ? Number(idAttr) : NaN;
      if (!Number.isFinite(bedId)) return;

      const createPreview = (element: HTMLElement) => {
        if (dragPreviewRef.current) {
          dragPreviewRef.current.remove();
          dragPreviewRef.current = null;
        }
        const rect = element.getBoundingClientRect();
        const clone = element.cloneNode(true) as HTMLElement;
        clone.classList.add("drag-preview");
        clone.removeAttribute("data-draggable-patient");
        clone.removeAttribute("data-draggable-bed");
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        clone.style.position = "fixed";
        clone.style.left = `${rect.left}px`;
        clone.style.top = `${rect.top}px`;
        clone.style.zIndex = "9999";
        clone.style.pointerEvents = "none";
        document.body.appendChild(clone);
        dragPreviewRef.current = clone;

        const handler = (ev: PointerEvent) => {
          if (!dragPreviewRef.current) return;
          const w = dragPreviewRef.current.offsetWidth;
          const x = ev.clientX - w / 2;
          const y = ev.clientY + 10;
          dragPreviewRef.current.style.left = `${Math.max(4, x)}px`;
          dragPreviewRef.current.style.top = `${Math.max(4, y)}px`;
        };
        pointerMoveHandlerRef.current = handler;
        document.addEventListener("pointermove", handler);

        const upHandler = () => {
          if (currentDraggedElRef.current) {
            if (dragPreviewRef.current) {
              dragPreviewRef.current.remove();
              dragPreviewRef.current = null;
            }
            if (pointerMoveHandlerRef.current) {
              document.removeEventListener("pointermove", pointerMoveHandlerRef.current);
              pointerMoveHandlerRef.current = null;
            }
            if (pointerUpHandlerRef.current) {
              document.removeEventListener("pointerup", pointerUpHandlerRef.current);
              document.removeEventListener("pointercancel", pointerUpHandlerRef.current);
              pointerUpHandlerRef.current = null;
            }
            currentDraggedElRef.current.classList.remove("drag-hidden");
            currentDraggedElRef.current = null;
            // limpiar iluminación de columnas solo cuando se suelta (pointerup)
            setAllowedColumns([]);
            setHighlightBedId(null);
            setDragging({ type: null });
            setHoverStatus(null);
          }
        };
        pointerUpHandlerRef.current = upHandler;
        document.addEventListener("pointerup", upHandler);
        document.addEventListener("pointercancel", upHandler);
      };

      const removePreviewAndCleanup = (element?: HTMLElement) => {
        if (dragPreviewRef.current) {
          dragPreviewRef.current.remove();
          dragPreviewRef.current = null;
        }
        if (pointerMoveHandlerRef.current) {
          document.removeEventListener("pointermove", pointerMoveHandlerRef.current);
          pointerMoveHandlerRef.current = null;
        }
        if (pointerUpHandlerRef.current) {
          document.removeEventListener("pointerup", pointerUpHandlerRef.current);
          document.removeEventListener("pointercancel", pointerUpHandlerRef.current);
          pointerUpHandlerRef.current = null;
        }
        if (element) element.classList.remove("drag-hidden");
        currentDraggedElRef.current = null;
      };

      const disposer = draggable({
        element: el,
        getInitialData: ({ element }) => ({
          type: "bed",
          id: bedId,
          rect: element.getBoundingClientRect(),
        }),
        onDragStart: () => {
          // columnas válidas cuando arrastramos una carta grande de cama (no Ocupada)
          setAllowedColumns(["Disponible", "Limpieza"]);
          setDragging({ type: "bed", id: bedId });
          el.classList.add("drag-hidden");
          currentDraggedElRef.current = el;
          createPreview(el);
        },
        onDrop: () => {
          setAllowedColumns([]);
          setHighlightBedId(null);
          setDragging({ type: null });
          setHoverStatus(null);
          setBedPlaceholder(null);
          removePreviewAndCleanup(el);
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
          // Show placeholder for patients only when dragging to allowed columns.
          if (isPatientDragData(source?.data)) {
            // find the patient details to decide allowed drops
            const patientId = source.data.id;
            const draggedPatient = patients.find((p) => p.id === patientId);
            // If patient is "sin cama", DO NOT allow dropping into "de alta"
            if (draggedPatient?.discharge_status === "sin cama" && status === "de alta") {
              // intentionally do not set hover/placeholder for "de alta"
              return;
            }
            if (status === "de alta" || status === "sin cama") {
              setHoverStatus(status);
              const rectHeight = source.data.rect?.height;
              setPlaceholderHeight(typeof rectHeight === "number" ? rectHeight : 48);
            }
          }
        },
        // Mantener la sombra mientras se arrastra: solo limpiar si NO es el mismo source que sigue arrastrándose
        onDragLeave: ({ source }) => {
          const active = draggingRef.current;
          let srcId: number | undefined;
          if (source?.data && (isPatientDragData(source.data) || isBedDragData(source.data))) {
            // ahora es seguro leer .id porque los type-guards lo garantizan
            srcId = source.data.id;
          } else {
            srcId = undefined;
          }
          if (active && srcId !== undefined && active.id === srcId) {
            // Mismo elemento sigue arrastrándose: no limpiar el placeholder
            return;
          }
          // distinto source o sin source: limpiar estados
          setHoverStatus(null);
          setPlaceholderHeight(null);
          setBedPlaceholder(null);
          // si el pointer sale por completo, también quitar iluminación de columnas posibles
        },
        onDrop: ({ source }) => {
          if (!source?.data) {
            setHoverStatus(null);
            setPlaceholderHeight(null);
            setBedPlaceholder(null);
            setAllowedColumns([]);
            setHighlightBedId(null);
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
              setAllowedColumns([]);
              setHighlightBedId(null);
              return;
            }
          } else if (isPatientDragData(source.data)) {
            const patientId = source.data.id;
            const draggedPatient = patients.find((p) => p.id === patientId);
            // prevent inserting "sin cama" patients into "de alta"
            if (draggedPatient?.discharge_status === "sin cama" && status === "de alta") {
              // ignore drop
            } else {
              if (status === "sin cama") {
                void updatePatientStatusById(patientId, "sin cama");
              } else if (status === "de alta") {
                void updatePatientStatusById(patientId, "de alta");
              }
            }
          }
          setHoverStatus(null);
          setDragging({ type: null });
          setPlaceholderHeight(null);
          setBedPlaceholder(null);
          setAllowedColumns([]);
          setHighlightBedId(null);
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
        onDragLeave: ({ source }) => {
          const active = draggingRef.current;
          let srcId: number | undefined;
          if (source?.data && (isPatientDragData(source.data) || isBedDragData(source.data))) {
            srcId = source.data.id;
          } else {
            srcId = undefined;
          }
          if (active && srcId !== undefined && active.id === srcId) {
            // keep highlight until drop for same dragged element
            return;
          }
          setHoverStatus(null);
          // si salimos de la tarjeta objetivo y no hay drag activo, limpiar columnas permitidas
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
          setAllowedColumns([]);
          setHighlightBedId(null);
        },
      });
      disposers.push(() => disposer?.());
    });

    return () => {
      disposers.forEach((d) => d());
      // cleanup any lingering preview / handlers
      if (dragPreviewRef.current) {
        dragPreviewRef.current.remove();
        dragPreviewRef.current = null;
      }
      if (pointerMoveHandlerRef.current) {
        document.removeEventListener("pointermove", pointerMoveHandlerRef.current);
        pointerMoveHandlerRef.current = null;
      }
      if (pointerUpHandlerRef.current) {
        document.removeEventListener("pointerup", pointerUpHandlerRef.current);
        document.removeEventListener("pointercancel", pointerUpHandlerRef.current);
        pointerUpHandlerRef.current = null;
      }
      if (currentDraggedElRef.current) {
        currentDraggedElRef.current.classList.remove("drag-hidden");
        currentDraggedElRef.current = null;
      }
      // asegurar limpieza final de iluminación en el desmontaje
      setAllowedColumns([]);
      setHighlightBedId(null);
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
      <h3 className="text-2xl text-center font-bold mb-4">Gestión de Pacientes y Camas</h3>
      <div className="grid grid-cols-1 gap-4 w-full">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 w-full">
          {/* Unassigned patients */}
          <div
            className={`col-span-1 bg-white/10 rounded-lg p-4 min-h-[220px] flex flex-col ${allowedColumns.includes("sin cama") ? "ring-2 ring-sky-400 bg-sky-900/20" : ""}`}
            data-drop-column="sin cama"
          >
            <h4 className="font-semibold mb-2 text-center">
              Pacientes (sin cama)  {unassignedPatients.length}
            </h4>
            <div className="flex-1">
              {/* placeholder para mini-tarjeta: igual que en columna "de alta" */}
              {hoverStatus === "sin cama" ? (
                <div
                  className="mb-2 bg-white/20 rounded shadow p-2 transition-all duration-200"
                  style={placeholderHeight ? { height: `${placeholderHeight}px` } : undefined}
                />
              ) : null}
              {unassignedPatients.map((p) => (
                <div
                  key={p.id}
                  data-draggable-patient={String(p.id)}
                  className="mb-2 bg-white/20 rounded shadow p-2 transition-all duration-300 ease-in-out transform-gpu will-change-transform"
                >
                  <div className="font-bold">{p.name}</div>
                  <div className="text-xs">Hora De Ingreso: {p.estimated_time ? to12Hour(p.estimated_time) : "—"}</div>
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
                className={`bg-white/10 rounded-lg p-4 min-h-[220px] ${allowedColumns.includes(status) ? "ring-2 ring-sky-400 bg-sky-900/20" : ""}`}
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
                        // Only make bed draggable when it's not Ocupada / no active patient
                        data-draggable-bed={bed.status !== "Ocupada" && !hasActivePatient ? String(bed.id) : undefined}
                        data-drop-bed={String(bed.id)}
                        className={`mb-2 rounded shadow p-2 transition-all duration-300 ease-in-out transform-gpu will-change-transform ${isBedHighlight ? "ring-2 ring-sky-400 bg-sky-900/30" : ""} ${bed.id === highlightBedId ? "ring-2 ring-sky-400" : ""} ${bed.status === "Disponible"
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

                        {/* No mostramos texto 'Bloqueada'. La cama ocupada NO es draggable; la mini-tarjeta de paciente dentro sí lo es. */}

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
          <div
            className={`col-span-1 bg-white/10 rounded-lg p-4 min-h-[220px] flex flex-col ${allowedColumns.includes("de alta") ? "ring-2 ring-sky-400 bg-sky-900/20" : ""}`}
            data-drop-column="de alta"
          >
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
                    Hora de salida: {p.discharge_time ? to12HourWithDate(p.discharge_time) : "—"}
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
