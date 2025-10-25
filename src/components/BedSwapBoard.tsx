"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { useUser } from "@clerk/nextjs";
import { AiOutlineCheckCircle } from "react-icons/ai";
import { FaStethoscope, FaUserInjured } from "react-icons/fa";
import { IoExitOutline } from "react-icons/io5";
import { MdMedicalServices, MdOutlineCleaningServices } from "react-icons/md";
import { RiCloseCircleLine } from "react-icons/ri";
import { RiDoorOpenLine } from "react-icons/ri";
import useSWR, { useSWRConfig } from "swr";

import { showToast } from "@/components/toastService";
import { AuxBedStatus, Bed, Discharge, Patient, Procedure, Room } from "@/types"; // <-- añadí Discharge + Procedure
import { Roles } from "@/types/globals";
import { to12Hour, to12HourWithDate, to12HourWithDateShort } from "@/utils/time"; // <-- importar to12Hour

import GradientText from './GradientText';

function formatDate(date: Date | string | null | undefined) {
  // reutilizamos util consistente que devuelve "YYYY-MM-DD h:mm AM/PM"
  return to12HourWithDate(date);
}

// Nota: la constante de orden de columnas se removió (no se usaba).

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
  // --- Clerk: obtener role desde publicMetadata (cliente)
  const { user } = useUser();
  const role = (user?.publicMetadata?.role ?? null) as Roles | null;
  const canViewColumn = (name: string) => {
    if (role === "doctor_general") return true;
    if (role === "enfermera_jefe") return name === "Limpieza" || name === "Disponible";
    // por defecto, ocultar columnas sensibles
    return false;
  };

  const { mutate } = useSWRConfig();
  const { data: bedsData } = useSWR<Bed[]>("/api/beds");
  const { data: roomsData } = useSWR<Room[]>("/api/rooms");
  const { data: patientsData } = useSWR<Patient[]>("/api/patients");
  const { data: dischargesData } = useSWR<Discharge[]>("/api/discharges");

  const [beds, setBeds] = useState<Bed[]>(Array.isArray(bedsData) ? bedsData : []);
  const [rooms, setRooms] = useState<Room[]>(Array.isArray(roomsData) ? roomsData : []);
  const [patients, setPatients] = useState<Patient[]>(Array.isArray(patientsData) ? patientsData : []);
  const [discharges, setDischarges] = useState<Discharge[]>(Array.isArray(dischargesData) ? dischargesData : []);

  // Cambia el tipo de recentDischarge para que incluya todas las propiedades de Patient y discharge_time
  type RecentDischargeType = Patient & { discharge_time: string };

  const [recentDischarge, setRecentDischarge] = useState<RecentDischargeType | null>(null);

  // --- NOTAS: estado local para diagnósticos/procedimientos (textarea en la columna Diagnóstico/Proced.) ---
  const [diagnosticNotes, setDiagnosticNotes] = useState<Record<number, string>>({});

  // Modals & procedures state
  const [openDiagFor, setOpenDiagFor] = useState<number | null>(null);
  const [openProcFor, setOpenProcFor] = useState<number | null>(null);
  const [procList, setProcList] = useState<Record<number, Procedure[]>>({});
  const [procInput, setProcInput] = useState<string>("");
  const [procAudio, setProcAudio] = useState<File | null>(null); // nuevo estado para audio (subida)
  // edición / borrado de procedimientos (frontend)
  const [editingProcId, setEditingProcId] = useState<number | null>(null);
  const [editProcDesc, setEditProcDesc] = useState<Record<number, string>>({});
  // Recording state for procedures (in-modal recorder)
  const [_procRecording, _setProcRecording] = useState<boolean>(false);
  const _procRecorderRef = useRef<MediaRecorder | null>(null);
  const _procChunksRef = useRef<BlobPart[]>([]);
  const [procBlobRecorded, setProcBlobRecorded] = useState<Blob | null>(null);
  const [procUrlRecorded, setProcUrlRecorded] = useState<string | null>(null);
  const [procDurationRecorded, setProcDurationRecorded] = useState<number | null>(null);
  const _procStartRef = useRef<number | null>(null);
  // Recording state for DIAGNÓSTICO (fueron los identificadores que faltaban)
  const [diagRecording, setDiagRecording] = useState<boolean>(false);
  const diagRecorderRef = useRef<MediaRecorder | null>(null);
  const diagChunksRef = useRef<BlobPart[]>([]);
  const [diagBlob, setDiagBlob] = useState<Blob | null>(null);
  const [diagUrl, setDiagUrl] = useState<string | null>(null);
  const [diagDuration, setDiagDuration] = useState<number | null>(null);
  const diagStartRef = useRef<number | null>(null);

  // --- NEW: Recording & state for PRE-EGRESO (mirrors diagnóstico) ---
  const [preEgresoNotes, setPreEgresoNotes] = useState<Record<number, string>>({});
  const [preEgresoRecording, setPreEgresoRecording] = useState<boolean>(false);
  const preEgresoRecorderRef = useRef<MediaRecorder | null>(null);
  const preEgresoChunksRef = useRef<BlobPart[]>([]);
  const [preEgresoBlob, setPreEgresoBlob] = useState<Blob | null>(null);
  const [preEgresoUrl, setPreEgresoUrl] = useState<string | null>(null);
  const [preEgresoDuration, setPreEgresoDuration] = useState<number | null>(null);
  const preEgresoStartRef = useRef<number | null>(null);
  const [preEgresoSaving, setPreEgresoSaving] = useState(false);

  // UI: estados de "saving" para modales (diagnóstico / procedimientos)
  const [diagSaving, setDiagSaving] = useState(false);
  const [procEditingSaving, setProcEditingSaving] = useState<Record<number, boolean>>({});

  // Nuevo: estado y helper para modal de perfil del paciente (corrige errores "openProfile" no definido)
  const [openProfileFor, setOpenProfileFor] = useState<number | null>(null);
  const [profilePatient, setProfilePatient] = useState<Patient | null>(null);

  // Nuevo: edición de perfil
  const [profileForm, setProfileForm] = useState<{
    name?: string;
    city?: string | null;
    phone?: string | null;
    blood_type?: string | null;
    birth_date?: string | null;
    extra_comment?: string | null;
  }>({});

  // Nuevo: estado para tab activo en el modal de paciente
  const [profileTab, setProfileTab] = useState<"perfil" | "diagnostico" | "procedimientos" | "pre-egreso">("perfil");

  const openProfile = useCallback(
    async (patientId: number) => {
      // intentar resolver desde cache local primero
      const local = patients.find((p) => p.id === patientId) ?? null;
      setProfilePatient(local);
      setOpenProfileFor(patientId);
      setProfileTab("perfil");
      // si no está en cache o quieres datos frescos, pedir al backend
      if (!local) {
        try {
          const res = await fetch(`/api/patients/${patientId}`);
          if (res.ok) {
            const data = (await res.json()) as Patient;
            setProfilePatient(data);
            // inicializar formulario con datos del servidor
            setProfileForm({
              name: data.name,
              city: data.city ?? null,
              phone: data.phone ?? null,
              blood_type: data.blood_type ?? null,
              birth_date: data.birth_date ?? null,
              extra_comment: data.extra_comment ?? null,
            });
          }
        } catch (err) {
          console.error("Error cargando perfil de paciente:", err);
        }
      } else {
        // inicializar formulario con cache local
        setProfileForm({
          name: local.name,
          city: local.city ?? null,
          phone: local.phone ?? null,
          blood_type: local.blood_type ?? null,
          birth_date: local.birth_date ?? null,
          extra_comment: local.extra_comment ?? null,
        });
      }
    },
    [patients],
  );

  // Guardado al backend (onBlur / modal). Revalida SWR tras guardar.
  const saveDiagnosticNote = useCallback(
    async (patientId: number, text: string, audioBlob?: Blob, recordedAt?: string, durationSeconds?: number) => {
      try {
        if (audioBlob) {
          const fd = new FormData();
          fd.append("diagnosticos_procedimientos", text ?? "");
          fd.append("file", audioBlob, `diagnosis-${Date.now()}.webm`);
          if (recordedAt) fd.append("recorded_at", recordedAt);
          if (typeof durationSeconds === "number") fd.append("duration_seconds", String(durationSeconds));
          // POST a endpoint que maneje multipart (backend debe implementar)
          await fetch(`/api/patients/${patientId}/diagnosis`, {
            method: "POST",
            body: fd,
          });
        } else {
          await fetch(`/api/patients/${patientId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ diagnosticos_procedimientos: text }),
          });
        }
        // Registrar entrada en patient_history con la fecha/hora actual
        try {
          await fetch("/api/patient_history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patient_id: patientId,
              tipo: audioBlob ? "audio" : "texto",
              contenido: (text ?? (audioBlob ? "audio attached" : "")).slice(0, 2000),
              fecha: new Date().toISOString(),
            }),
          });
        } catch (historyErr) {
          console.warn("No se pudo registrar patient_history:", historyErr);
        }
        void mutate("/api/patients");
      } catch (err) {
        console.error("Error guardando nota diagnóstica:", err);
      }
    },
    [mutate],
  );

  // Guardar pre-egreso (texto o audio). Similar a saveDiagnosticNote.
  const savePreEgreso = useCallback(
    async (patientId: number, text: string, audioBlob?: Blob, recordedAt?: string, durationSeconds?: number) => {
      try {
        if (audioBlob) {
          const fd = new FormData();
          fd.append("patient_id", String(patientId));
          fd.append("contenido", text ?? "");
          fd.append("file", new File([audioBlob], `preegreso-${Date.now()}.webm`, { type: audioBlob.type || "audio/webm" }));
          if (recordedAt) fd.append("recorded_at", recordedAt);
          if (typeof durationSeconds === "number") fd.append("duration_seconds", String(durationSeconds));
          await fetch("/api/pre_egresos", { method: "POST", body: fd });
        } else {
          await fetch("/api/pre_egresos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patient_id: patientId, contenido: text }),
          });
        }
        // Registrar en patient_history (silencioso)
        try {
          await fetch("/api/patient_history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patient_id: patientId,
              tipo: audioBlob ? "audio" : "texto",
              contenido: (text ?? (audioBlob ? "audio pre-egreso" : "")).slice(0, 2000),
              fecha: new Date().toISOString(),
            }),
          });
        } catch (_historyErr) {
          // no bloquear el flujo si falla el historial
        }
        void mutate("/api/pre_egresos");
        void mutate("/api/patients");
      } catch (err) {
        console.error("Error guardando pre-egreso:", err);
      }
    },
    [mutate],
  );

  // Cargar procedimientos de un paciente al abrir modal
  const loadProcedures = useCallback(async (patientId: number) => {
    try {
      const res = await fetch(`/api/procedures?patientId=${patientId}`);
      if (!res.ok) return;
      const data = await res.json();
      setProcList((prev) => ({ ...prev, [patientId]: Array.isArray(data) ? data : [] }));
    } catch (e) {
      console.error("Error cargando procedimientos:", e);
    }
  }, []);
  // Agregar procedimiento (texto o audio). Prioriza procBlobRecorded (grabado) sobre procAudio (archivo seleccionado).
  const addProcedure = useCallback(
    async (patientId: number) => {
      if (!procInput.trim() && !procAudio && !procBlobRecorded) return;
      const temp: Procedure = {
        id: Date.now(),
        patient_id: patientId,
        descripcion: procInput.trim() || "(audio)",
        // created_at inicial optimista; si el backend devuelve el objeto, se reemplazará
        created_at: new Date().toISOString(),
        audio_url: procUrlRecorded ?? (procAudio ? URL.createObjectURL(procAudio) : undefined),
      };
      // optimistic: añadir temp a la lista
      setProcList((prev) => ({ ...prev, [patientId]: [...(prev[patientId] ?? []), temp] }));
      setProcInput("");
      const localFile = procAudio;
      const localRecorded = procBlobRecorded;
      const localRecordedDuration = procDurationRecorded;
      setProcAudio(null);
      setProcBlobRecorded(null);
      setProcUrlRecorded(null);
      setProcDurationRecorded(null);
      try {
        let res: Response | undefined;
        if (localRecorded) {
          const fd = new FormData();
          fd.append("patient_id", String(patientId));
          fd.append("descripcion", temp.descripcion);
          fd.append("file", new File([localRecorded], `procedure-${Date.now()}.webm`, { type: (localRecorded as Blob).type || "audio/webm" }));
          if (localRecordedDuration) fd.append("duration_seconds", String(localRecordedDuration));
          res = await fetch("/api/procedures", { method: "POST", body: fd });
        } else if (localFile) {
          const fd = new FormData();
          fd.append("patient_id", String(patientId));
          fd.append("descripcion", temp.descripcion);
          fd.append("file", localFile, localFile.name);
          res = await fetch("/api/procedures", { method: "POST", body: fd });
        } else {
          res = await fetch("/api/procedures", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patient_id: patientId, descripcion: temp.descripcion }),
          });
        }
        // Si backend devuelve el objeto creado, reemplazar la entrada temporal
        if (res?.ok) {
          let createdRaw: unknown = null;
          try {
            createdRaw = await res.json();
          } catch {
            createdRaw = null;
          }
          // validar shape sin usar `any`
          if (
            createdRaw &&
            typeof createdRaw === "object" &&
            "id" in createdRaw &&
            typeof (createdRaw as Record<string, unknown>).id === "number"
          ) {
            const createdProc = createdRaw as Procedure;
            setProcList((prev) => ({
              ...prev,
              [patientId]: (prev[patientId] ?? []).map((p) => (p.id === temp.id ? createdProc : p)),
            }));
          } else {
            // si backend respondió OK pero no devolvió JSON con objeto creado, actualizar timestamp local al completar
            setProcList((prev) => ({
              ...prev,
              [patientId]: (prev[patientId] ?? []).map((p) => (p.id === temp.id ? { ...p, created_at: new Date().toISOString() } : p)),
            }));
          }
        } else {
          // fallback: recargar la lista si algo falló en el POST (intentar una sola vez)
          await loadProcedures(patientId);
        }
      } catch (e) {
        console.error("Error guardando procedimiento:", e);
        // revert optimistic: recargar desde servidor
        await loadProcedures(patientId);
      }
    },
    [procInput, procAudio, procBlobRecorded, procUrlRecorded, procDurationRecorded, loadProcedures],
  );
  // Editar procedimiento — actualiza localmente para evitar GETs dobles
  const saveProcedureEdit = useCallback(async (procId: number, patientId: number) => {
    const newText = (editProcDesc[procId] ?? "").trim();
    if (!newText) return;
    setProcEditingSaving((s) => ({ ...(s ?? {}), [procId]: true }));
    try {
      const res = await fetch(`/api/procedures/${procId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion: newText }),
      });
      if (!res.ok) throw new Error("Error actualizando procedimiento");
      // optimistic local update (no GET adicional)
      const nowIso = new Date().toISOString();
      setProcList((prev) => ({
        ...prev,
        [patientId]: (prev[patientId] ?? []).map((p) =>
          p.id === procId ? { ...p, descripcion: newText, created_at: nowIso } : p
        ),
      }));
      // Registrar la edición en patient_history con la fecha/hora actual
      try {
        await fetch("/api/patient_history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patient_id: patientId,
            tipo: "texto",
            contenido: `Procedimiento #${procId} editado: ${newText}`.slice(0, 2000),
            fecha: new Date().toISOString(),
          }),
        });
      } catch (historyErr) {
        console.warn("No se pudo registrar patient_history tras editar procedimiento:", historyErr);
      }
      setEditingProcId(null);
    } catch (err) {
      console.error("Error guardando procedimiento:", err);
      // fallback: recargar
      await loadProcedures(patientId);
    } finally {
      setProcEditingSaving((s) => ({ ...(s ?? {}), [procId]: false }));
    }
  }, [editProcDesc, loadProcedures]);
  // Borrar procedimiento — actualiza localmente para evitar GETs dobles
  const deleteProcedure = useCallback(async (procId: number, patientId: number) => {
    if (!confirm("¿Eliminar este procedimiento? Esta acción no puede deshacerse.")) return;
    try {
      const res = await fetch(`/api/procedures/${procId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error eliminando procedimiento");
      setProcList((prev) => ({
        ...prev,
        [patientId]: (prev[patientId] ?? []).filter((p) => p.id !== procId),
      }));
      if (editingProcId === procId) setEditingProcId(null);
    } catch (err) {
      console.error("Error eliminando procedimiento:", err);
      // fallback: recargar
      await loadProcedures(patientId);
    }
  }, [loadProcedures, editingProcId]);

  // dragging state: { type: 'bed' | 'patient' | null, id?: number }
  const [_dragging, setDragging] = useState<{ type: "bed" | "patient" | null; id?: number }>({ type: null });

  // Ref to always have the latest dragging info inside event callbacks
  const draggingRef = useRef<{ type: "bed" | "patient" | null; id?: number }>(_dragging);
  useEffect(() => {
    draggingRef.current = _dragging;
  }, [_dragging]);

  const [hoverStatus, setHoverStatus] = useState<string | null>(null);
  const [placeholderHeight, setPlaceholderHeight] = useState<number | null>(null);
  // Prefijamos con _ para silenciar regla de "no-unused-vars" si la variable no se usa siempre
  const [_bedPlaceholder, setBedPlaceholder] = useState<{ status: string; height: number } | null>(null);

  // Nuevas columnas permitidas durante el "press/drag" para iluminar destinos válidos
  const [allowedColumns, setAllowedColumns] = useState<string[]>([]);
  // ID de la primera cama Disponible a resaltar mientras se arrastra un paciente "sin cama"
  const [_highlightBedId, setHighlightBedId] = useState<number | null>(null);

  // ref para tener siempre la última lista de columnas permitidas dentro de los callbacks de Pragmatic
  const allowedColumnsRef = useRef<string[]>([]);
  useEffect(() => {
    allowedColumnsRef.current = allowedColumns;
  }, [allowedColumns]);

  // NOTE: polling removed. SWR provides the data (bedsData/roomsData/etc.)
  // and mutate(...) is used to revalidate after mutations to avoid repeated GETs.

  // --- NEW: refs para preview flotante y handlers de pointer ---
  const dragPreviewRef = useRef<HTMLElement | null>(null);
  const pointerMoveHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);
  const pointerUpHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);
  const currentDraggedElRef = useRef<HTMLElement | null>(null);

  // sync local state with SWR responses
  useEffect(() => {
    setBeds(Array.isArray(bedsData) ? bedsData : []);
  }, [bedsData]);
  useEffect(() => {
    setRooms(Array.isArray(roomsData) ? roomsData : []);
  }, [roomsData]);
  useEffect(() => {
    setPatients(Array.isArray(patientsData) ? patientsData : []);
  }, [patientsData]);
  useEffect(() => {
    setDischarges(Array.isArray(dischargesData) ? dischargesData : []);
  }, [dischargesData]);

  // replace getRoomNumber helper with stable callback to satisfy hook deps
  const getRoomNumber = React.useCallback((room_id: number) => {
    return rooms.find((r) => r.id === room_id)?.number ?? room_id;
  }, [rooms]);

  // Normaliza el estado del paciente (prefiere discharge_status, luego status)
  function getPatientEffectiveStatus(p?: Patient): string {
    if (!p) return "";
    const raw = String(p.discharge_status ?? p.status ?? "").normalize("NFC").toLowerCase().trim();
    // Mapear variantes comunes a los estados esperados
    if (raw.includes("sin cama")) return "sin cama";
    if (raw.includes("con cama")) return "con cama";
    if (raw.includes("pre-egreso") || raw.includes("pre egreso") || raw.includes("preegreso")) return "pre-egreso";
    if (raw.includes("diagnosticos") || raw.includes("procedimiento")) return "diagnosticos_procedimientos";
    if (raw.includes("de alta") || raw.includes("alta")) return "de alta";
    // fallback al valor original normalizado
    return raw;
  }

  // Debug: inspeccionar pacientes recibidos (borra/quita en producción)
  useEffect(() => {
    if (Array.isArray(patients) && patients.length > 0) {
      console.debug("BedSwapBoard - pacientes count:", patients.length, "sample statuses:", patients.slice(0, 5).map(p => ({ id: p.id, status: p.status, discharge_status: p.discharge_status })));
    } else {
      console.debug("BedSwapBoard - pacientes vacío o sin cargar aún");
    }
  }, [patients]);

  // Obtener texto combinado de diagnóstico / procedimiento
  function _getPatientDiagnostics(p?: Patient) {
    if (!p) return "—";
    if (p.diagnosticos_procedimientos && String(p.diagnosticos_procedimientos).trim() !== "") {
      return String(p.diagnosticos_procedimientos);
    }
    const parts = [];
    if (p.diagnostico && String(p.diagnostico).trim() !== "") parts.push(String(p.diagnostico).trim());
    if (p.procedimiento && String(p.procedimiento).trim() !== "") parts.push(String(p.procedimiento).trim());
    return parts.length > 0 ? parts.join(" | ") : "—";
  }

  // helpers that operate by ids (invocables desde Pragmatic callbacks)
  const assignPatientToBed = useCallback(async (patientId: number, bedId: number) => {
    // allow assigning whether patient is unassigned or moving from another bed
    const patient = patients.find((p) => p.id === patientId);
    const prevBedId = patient?.bed_id ?? null;
    if (prevBedId === bedId) {
      // nothing to do
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
      // Optimistic UI update: mover paciente localmente, marcar nueva cama Ocupada y liberar previa (si aplica)
      const now = new Date();
      setPatients((prev) => movePatientToFront(prev, patientId, { bed_id: bedId, discharge_status: "con cama" }));
      setBeds((prev) =>
        sortBeds(
          prev.map((b) => {
            if (b.id === bedId) return { ...b, status: "Atención Médica", last_update: now };
            if (prevBedId && b.id === prevBedId) return { ...b, status: "Disponible", last_update: now };
            return b;
          }),
        ),
      );
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
    if (assigned && !getPatientEffectiveStatus(assigned).includes("de alta")) {
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
      // show toast for Limpieza / Disponible
      if (status === "Limpieza") {
        showToast({ title: `Cama ${bedId} — En limpieza`, description: "Se inició el proceso de limpieza.", type: "warning" });
      } else if (status === "Disponible") {
        showToast({ title: `Cama ${bedId} — Disponible`, description: "La cama quedó disponible.", type: "success" });
      }
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
            // toast
            showToast({ title: `Cama ${prevBedId} — Disponible`, description: "Paciente desasignado, cama disponible.", type: "success" });
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
            // --- NUEVO: mostrar notificación de limpieza automática con nombre del paciente ---
            showToast({
              title: `Cama ${prevBedId} — En limpieza`,
              description: `${current?.name ?? "Paciente"} entró a egreso. La cama quedó en limpieza.`,
              type: "warning",
            });
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
        getInitialData: ({ element }) => {
          // detectamos columna de origen (si existe) para saber desde dónde se arrastra
          const originEl = (element.closest("[data-drop-column]") as HTMLElement | null);
          const origin = originEl?.dataset.dropColumn ?? null;
          return {
            type: "patient",
            id: patientId,
            rect: element.getBoundingClientRect(),
            origin,
          };
        },
        onDragStart: () => {
          const p = patients.find((x) => x.id === patientId);
          const eff = getPatientEffectiveStatus(p);
          if (eff.includes("sin cama")) {
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
            setHighlightBedId(mostRecentAvailable?.id ?? null);
          } else {
            // paciente con cama u otros:
            // - si viene de diagnóstico/procedimiento permitir mover a Ocupada (Atención Médica) y Disponible
            // - en general permitir diagnóstico, pre-egreso, de alta y ver camas Disponibles
            if (eff === "diagnosticos_procedimientos") {
              setAllowedColumns(["diagnosticos_procedimientos", "pre-egreso", "de alta", "Disponible", "Ocupada"]);
            } else {
              // NOTA: no incluimos "sin cama" aquí para evitar mover tarjetas directamente a Admisiones.
              setAllowedColumns(["diagnosticos_procedimientos", "pre-egreso", "de alta", "Disponible"]);
            }
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

    // drop targets: columns (Limpieza, Disponible, Ocupada, plus dynamic ones)
    document.querySelectorAll<HTMLElement>("[data-drop-column]").forEach((el) => {
      const status = el.dataset.dropColumn!;
      if (!status) return;
      const disposer = dropTargetForElements({
        element: el,
        onDragEnter: ({ source }) => {
          // Sólo mostrar placeholders si la columna está permitida para el elemento arrastrado.
          if (isBedDragData(source?.data)) {
            if (!allowedColumnsRef.current.includes(status)) return;
            if (status === "Ocupada") return;
            setHoverStatus(status);
            if (status === "Disponible" || status === "Limpieza") {
              const rectHeight = (source.data as BedDragData & { rect?: DOMRect }).rect?.height;
              setBedPlaceholder({ status, height: typeof rectHeight === "number" ? rectHeight : 56 });
            }
            return;
          }
          if (isPatientDragData(source?.data)) {
            // sólo permitir placeholder si la columna forma parte de las allowedColumns actuales
            if (!allowedColumnsRef.current.includes(status)) return;
            const patientId = source.data.id;
            const draggedPatient = patients.find((p) => p.id === patientId);
            // Prevent dropping into certain columns when patient has NO assigned bed
            if ((!draggedPatient?.bed_id) && (status === "de alta" || status === "pre-egreso" || status === "diagnosticos_procedimientos")) {
              return;
            }
            // set visual placeholder size for patient card
            setHoverStatus(status);
            const rectHeight = source.data.rect?.height;
            setPlaceholderHeight(typeof rectHeight === "number" ? rectHeight : 48);
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
            return;
          }
          setHoverStatus(null);
          setPlaceholderHeight(null);
          setBedPlaceholder(null);
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
          // Patient drops to column-level targets handled here (status-based)
          if (isPatientDragData(source.data)) {
            const patientId = source.data.id;
            const draggedPatient = patients.find((p) => p.id === patientId);
            const originCol = (source.data as PatientDragData & { origin?: string })?.origin ?? null;
            // 1) Si se suelta SOBRE "Disponible" y la tarjeta viene desde "Ocupada",
            // liberar cama y devolver paciente a admisiones (sin cama).
            if (status === "Disponible" && draggedPatient?.bed_id && originCol === "Ocupada") {
              // Optimistic UI: marcar paciente como sin cama y marcar su cama anterior como Disponible
              setPatients((prev) => movePatientToFront(prev, patientId, { bed_id: null, discharge_status: "sin cama" }));
              if (draggedPatient?.bed_id) {
                const now = new Date();
                setBeds((prev) => sortBeds(prev.map((b) => (b.id === draggedPatient.bed_id ? { ...b, status: "Disponible", last_update: now } : b))));
              }
              // Persistir en backend y revalidar caches
              void fetch(`/api/patients/${patientId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "sin cama", bed_id: null }),
              })
                .then(() => {
                  void mutate("/api/patients");
                  void mutate("/api/beds");
                })
                .catch((e) => console.error("PUT sin cama failed:", e));
              setHoverStatus(null);
              setAllowedColumns([]);
              setHighlightBedId(null);
              return;
            }
            // 1.b) Si se suelta SOBRE "Ocupada" viniendo desde "diagnosticos_procedimientos",
            // volver a marcar al paciente como 'con cama' (mantener bed_id).
            if (status === "Ocupada" && draggedPatient?.bed_id && originCol === "diagnosticos_procedimientos") {
              // Optimistic UI: marcar paciente como con cama y la cama como Atención Médica
              setPatients((prev) => movePatientToFront(prev, patientId, { discharge_status: "con cama", bed_id: draggedPatient.bed_id }));
              {
                const now = new Date();
                setBeds((prev) => sortBeds(prev.map((b) => (b.id === draggedPatient.bed_id ? { ...b, status: "Atención Médica", last_update: now } : b))));
              }
              // Persistir en backend y revalidar caches
              void fetch(`/api/patients/${patientId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "con cama", bed_id: draggedPatient.bed_id }),
              })
                .then(() => {
                  void mutate("/api/patients");
                  void mutate("/api/beds");
                })
                .catch((e) => console.error("PUT con cama failed:", e));
              setHoverStatus(null);
              setAllowedColumns([]);
              setHighlightBedId(null);
              return;
            }
            // 2) No permitir drop directo a "sin cama" desde drags normales (no es la acción deseada)
            if (status === "sin cama") {
              // ignorar: no permitir mover tarjetas directamente a Admisiones
              return;
            }
            if ((status === "de alta" || status === "pre-egreso" || status === "diagnosticos_procedimientos") && !draggedPatient?.bed_id) {
              // ignore drop when bedless
            } else {
              if (status === "sin cama") {
                // removed direct admission moves; handled only via Atención Médica -> Disponible
                // no-op
              } else if (status === "de alta") {
                // Optimistic UI: marcar paciente como de alta y si tenía cama, marcarla Limpieza
                setPatients((prev) => movePatientToFront(prev, patientId, { discharge_status: "de alta", bed_id: null }));
                if (draggedPatient?.bed_id) {
                  const now = new Date();
                  setBeds((prev) => sortBeds(prev.map((b) => (b.id === draggedPatient.bed_id ? { ...b, status: "Limpieza", last_update: now } : b))));
                  // Mostrar notificación de limpieza automática (incluye habitación si la podemos resolver)
                  const bedObj = beds.find((bb) => bb.id === draggedPatient.bed_id);
                  const roomNum = bedObj ? getRoomNumber(bedObj.room_id) : "—";
                  showToast({
                    title: `Cama ${draggedPatient.bed_id} — En limpieza automática`,
                    description: `${draggedPatient?.name ?? "Paciente"} entró a egreso. Habitación ${roomNum}.`,
                    type: "warning",
                  });
                }
                // Mostrar inmediatamente en la columna "Egreso" la tarjeta dada de alta
                if (draggedPatient) {
                  setRecentDischarge({
                    ...(draggedPatient as Patient),
                    discharge_time: new Date().toISOString(),
                    discharge_status: "de alta",
                    bed_id: null,
                  });
                }
                // Persistir en backend y revalidar caches
                void fetch(`/api/patients/${patientId}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "de alta" }),
                })
                  .then(() => {
                    void mutate("/api/patients");
                    void mutate("/api/beds");
                    void mutate("/api/discharges");
                  })
                  .catch((e) => console.error("PUT de alta failed:", e));
              } else if (status === "diagnosticos_procedimientos") {
                // Optimistic UI: marcar paciente localmente como en diagnóstico/procedimiento
                setPatients((prev) => movePatientToFront(prev, patientId, { discharge_status: "diagnosticos_procedimientos" }));
                // Si el paciente tiene cama, marcar esa cama localmente para que aparezca en la columna correspondiente
                if (draggedPatient?.bed_id) {
                  const now = new Date();
                  setBeds((prev) =>
                    sortBeds(prev.map((b) => (b.id === draggedPatient.bed_id ? { ...b, status: "Diagnostico y Procedimiento", last_update: now } : b)))
                  );
                }
                // Persistir en backend y revalidar caches
                void fetch(`/api/patients/${patientId}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "diagnosticos_procedimientos" }),
                })
                  .then(() => {
                    void mutate("/api/patients");
                    void mutate("/api/beds");
                  })
                  .catch((e) => console.error("PUT diagnosticos_procedimientos failed:", e));
              } else if (status === "pre-egreso") {
                // Optimistic UI: marcar paciente localmente como pre-egreso
                setPatients((prev) => movePatientToFront(prev, patientId, { discharge_status: "pre-egreso" }));
                if (draggedPatient?.bed_id) {
                  const now = new Date();
                  setBeds((prev) => sortBeds(prev.map((b) => (b.id === draggedPatient.bed_id ? { ...b, status: "Pre-egreso", last_update: now } : b))));
                }
                void fetch(`/api/patients/${patientId}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "pre-egreso" }),
                })
                  .then(() => {
                    void mutate("/api/patients");
                    void mutate("/api/beds");
                  })
                  .catch((e) => console.error("PUT pre-egreso failed:", e));
              }
            }
          } else if (isBedDragData(source.data)) {
            // Beds dragged to column-level: allow only Disponible <-> Limpieza
            const bedIdDropped = source.data.id;
            if (status === "Disponible" || status === "Limpieza") {
              void changeBedStatusById(bedIdDropped, status as "Limpieza" | "Disponible");
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
          // highlight only if dragging a PATIENT and the target bed is AVAILABLE
          if (source?.data?.type === "patient") {
            const patientId = source.data.id as number;
            const patient = patients.find((p) => p.id === patientId);
            const targetBed = beds.find((b) => b.id === bedId);
            if (targetBed?.status === "Disponible" && patient?.bed_id !== targetBed.id) {
              setHoverStatus(`bed-${bedId}`);
            }
          }
          // show placeholder for bed cards when dragging a bed element
          if (source?.data && isBedDragData(source.data)) {
            // do nothing special here for bed cards; column-level handles bed moves
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
            return;
          }
          setHoverStatus(null);
        },
        onDrop: ({ source }) => {
          if (source?.data?.type === "patient") {
            const patientId = source.data.id as number;
            const patient = patients.find((p) => p.id === patientId);
            const targetBed = beds.find((b) => b.id === bedId);
            if (targetBed?.status === "Disponible" && patient?.bed_id !== bedId) {
              void assignPatientToBed(patientId, bedId);
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
  }, [beds, patients, assignPatientToBed, changeBedStatusById, updatePatientStatusById, getRoomNumber, mutate]);

  // Group beds by status, ordenando cada grupo por last_update descendente
  const statusGroups: Record<string, Bed[]> = {
    Limpieza: [],
    Disponible: [],
    "Atención Médica": [],
    "Diagnostico y Procedimiento": [],
    "Pre-egreso": [],
    Mantenimiento: [],
    Aislamiento: [],
    Reserva: [],
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
  const unassignedPatients = Array.isArray(patients)
    ? patients
      .filter((p) => !p.bed_id && getPatientEffectiveStatus(p) === "sin cama")
      .slice()
      .sort((a, b) => {
        const ta = a.estimated_time ?? "";
        const tb = b.estimated_time ?? "";
        if (!ta && !tb) return 0;
        if (!ta) return 1;
        if (!tb) return -1;
        return ta.localeCompare(tb);
      })
    : [];

  // Pacientes dados de alta: ordenar por expected_time (discharges) descendente para que los más recientes queden arriba
  let dischargedPatients = Array.isArray(patients)
    ? patients
      .filter((p) => getPatientEffectiveStatus(p).includes("de alta"))
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
      })
    : [];

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

  // Mostrar en Diagnóstico / Proced. las camas ocupadas cuyo paciente tiene discharge_status === "diagnosticos_procedimientos"
  const diagnosticBeds = statusGroups["Diagnostico y Procedimiento"].filter((bed) => {
    const assigned = patients.find((p) => p.bed_id === bed.id);
    return assigned && getPatientEffectiveStatus(assigned) === "diagnosticos_procedimientos";
  });

  // Pacientes con egreso (pre-egreso) representados como CAMAS ocupadas para mover la tarjeta completa
  const preEgresoBeds = statusGroups["Pre-egreso"].filter((bed) => {
    const assigned = patients.find((p) => p.bed_id === bed.id);
    return assigned && getPatientEffectiveStatus(assigned) === "pre-egreso";
  });

  // Render: remove native drag event attributes; add data-attrs for Pragmatic
  return (
    // tarjeta principal del gestor
    <div className="card">
      <div className="text-center">
        <GradientText
          colors={["#40ffaa", "#4079ff", "#40ffaa", "#4079ff", "#40ffaa"]}
          animationSpeed={3}
          showBorder={false}
          className="mb-3 text-4xl font-black leading-tight text-black"
        >
          SYO - IA
        </GradientText>
        <div className="text-xl text-gray-600 font-semibold">Gestión Dinámica y Asistida de Camas y Pacientes</div>
      </div>
      <div className="w-full max-w-full">
        {/* Cambiado: usar flex con overflow-x-auto para móviles, manteniendo grid en desktop */}
        <div className="md:grid md:grid-cols-7 md:gap-4 md:w-full flex overflow-x-auto gap-4 w-full p-4">
          {/* Column: Admisiones */}
          {canViewColumn("sin cama") && (
            <div
              className={`flex-shrink-0 w-64 md:flex-shrink md:w-auto bg-gray-200 rounded-lg p-4 min-h-[220px] flex flex-col ${allowedColumns.includes("sin cama") ? "ring-2 ring-sky-400" : ""}`}
              data-drop-column="sin cama"
            >
              <h4 className="uppercase font-extrabold mb-2 text-center">
                ADMISIONES {unassignedPatients.length}
              </h4>
              <div className="flex-1">
                {/* placeholder para mini-tarjeta: igual que en columna "de alta" */}
                {hoverStatus === "sin cama" ? (
                  <div
                    className="mb-2 bg-white/20 rounded shadow p-2 transition-all duration-200"
                    style={placeholderHeight ? { height: `${placeholderHeight}px` } : undefined}
                  />
                ) : null}
                {unassignedPatients.length === 0 ? (
                  <div className="text-center text-gray-400">No hay pacientes sin cama</div>
                ) : (
                  unassignedPatients.map((p) => (
                    <div
                      key={p.id}
                      data-draggable-patient={String(p.id)}
                      className="bg-white card-item relative transition-all duration-300 ease-in-out transform-gpu"
                    >
                      <button
                        type="button"
                        className="bg-white font-bold text-left w-full text-black hover:underline mt-2"
                        onClick={() => openProfile(p.id)}
                      >
                        {p.name}
                      </button>
                      {/* Mostrar fecha y hora completa de ingreso si existe */}
                      <div className="meta">
                        Hora de Ingreso: {p.estimated_time ? to12HourWithDateShort(p.estimated_time) : "—"}
                      </div>

                      <div className="absolute top-2 right-2 text-xl text-gray-700 opacity-90 pointer-events-none">
                        <FaUserInjured />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {/* Column: Camas disponibles */}
          {canViewColumn("Disponible") && (
            <div
              className={`flex-shrink-0 w-64 md:flex-shrink md:w-auto bg-gray-200 rounded-lg p-4 min-h-[220px] ${allowedColumns.includes("Disponible") ? "ring-2 ring-sky-400" : ""}`}
              data-drop-column="Disponible"
            >
              <h4 className="uppercase font-extrabold mb-2 text-center">CAMAS DISPONIBLES</h4>
              <div className="flex-1">
                {/* Placeholder de paciente (preview shadow) cuando se arrastra una tarjeta de paciente */}
                {allowedColumns.includes("Disponible") && hoverStatus === "Disponible" && placeholderHeight ? (
                  <div
                    className="mb-2 bg-white/20 rounded shadow p-2 transition-all duration-200"
                    style={placeholderHeight ? { height: `${placeholderHeight}px` } : undefined}
                  />
                ) : null}
                {/* Placeholder para preview cuando se arrastra una tarjeta de cama hacia Disponible (sólo si está permitido) */}
                {allowedColumns.includes("Disponible") && hoverStatus === "Disponible" && _bedPlaceholder?.status === "Disponible" ? (
                  <div
                    className="mb-2 bg-white/20 rounded shadow p-2 transition-all duration-200"
                    style={_bedPlaceholder?.height ? { height: `${_bedPlaceholder.height}px` } : undefined}
                  />
                ) : null}
                {statusGroups.Disponible.map((bed) => {
                  const assigned = patients.find((p) => p.bed_id === bed.id);
                  const hasActivePatient = Boolean(assigned && getPatientEffectiveStatus(assigned) !== "de alta");
                  const isBedHighlight = hoverStatus === `bed-${bed.id}` || _highlightBedId === bed.id;
                  return (
                    <div
                      key={bed.id}
                      // permitir arrastrar camas siempre que no sean "Atención Médica" y no tengan paciente activo
                      data-draggable-bed={!hasActivePatient && bed.status !== "Atención Médica" ? String(bed.id) : undefined}
                      data-drop-bed={String(bed.id)}
                      className={`card-item relative ${isBedHighlight ? "ring-2 ring-sky-400" : ""} border-l-4 border-green-600 bg-green-100/80`}
                    >
                      <div className="font-bold">CAMA {bed.id}</div>
                      <div className="text-md text-gray-700 font-semibold mt-0.5">Habit. {getRoomNumber(bed.room_id)}</div>
                      <div className="meta">{formatDate(bed.last_update)}</div>
                      <div className="mt-2 meta">
                        {assigned ? (
                          <div className="mt-2 p-2 rounded bg-red-200/90">
                            <button
                              type="button"
                              className="font-medium text-left w-full text-red-800 hover:underline"
                              onClick={() => openProfile(assigned.id)}
                            >
                              {assigned.name}
                            </button>
                          </div>
                        ) : (
                          "Sin paciente"
                        )}
                      </div>
                      <div className="absolute top-2 right-2 text-2xl text-green-600 opacity-90 pointer-events-none">
                        <AiOutlineCheckCircle />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* Column: Atención médica (camas ocupadas) */}
          {canViewColumn("Ocupada") && (
            <div className={`flex-shrink-0 w-64 md:flex-shrink md:w-auto bg-gray-200 rounded-lg p-4 min-h-[220px] flex flex-col ${allowedColumns.includes("Ocupada") ? "ring-2 ring-sky-400" : ""}`} data-drop-column="Ocupada">
              <h4 className="uppercase font-extrabold mb-2 text-center">ATENCIÓN MÉDICA</h4>
              <div className="flex-1">
                {/* Placeholder de paciente cuando se arrastra una tarjeta (ej. desde Diagnóstico) hacia Atención Médica */}
                {allowedColumns.includes("Ocupada") && hoverStatus === "Ocupada" && placeholderHeight ? (
                  <div
                    className="mb-2 bg-white/20 rounded shadow p-2 transition-all duration-200"
                    style={placeholderHeight ? { height: `${placeholderHeight}px` } : undefined}
                  />
                ) : null}
                {statusGroups["Atención Médica"]
                  .filter((bed) => {
                    const assigned = patients.find((p) => p.bed_id === bed.id);
                    return !assigned || (getPatientEffectiveStatus(assigned) !== "diagnosticos_procedimientos" && getPatientEffectiveStatus(assigned) !== "pre-egreso");
                  })
                  .map((bed) => {
                    const assigned = patients.find((p) => p.bed_id === bed.id);
                    const isBedHighlight = hoverStatus === `bed-${bed.id}` || _highlightBedId === bed.id;
                    return (
                      <div
                        key={bed.id}
                        data-draggable-patient={assigned ? String(assigned.id) : undefined}
                        className={`card-item relative ${isBedHighlight ? "ring-2 ring-sky-400" : ""} border-l-4 border-red-600 bg-red-100/80`}
                      >
                        <div className="font-bold">CAMA {bed.id}</div>
                        <div className="text-md text-gray-700 font-semibold mt-0.5">Habit. {getRoomNumber(bed.room_id)}</div>
                        <div className="meta">{formatDate(bed.last_update)}</div>
                        {assigned ? (
                          <div className="mt-2 p-2 rounded bg-red-200/90">
                            <button
                              type="button"
                              className="font-medium text-left w-full text-red-800 hover:underline"
                              onClick={() => openProfile(assigned.id)}
                            >
                              {assigned.name}
                            </button>
                          </div>
                        ) : (
                          <div className="mt-2 meta">Sin paciente</div>
                        )}
                        <div className="absolute right-2 text-2xl text-red-600 opacity-90 pointer-events-none top-2">
                          <FaStethoscope />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
          {/* Columna: Procedimiento (Diagnóstico / Proced.) */}
          {canViewColumn("diagnosticos_procedimientos") && (
            <div className={`flex-shrink-0 w-64 md:flex-shrink md:w-auto bg-gray-200 rounded-lg p-4 min-h-[220px] flex flex-col ${allowedColumns.includes("diagnosticos_procedimientos") ? "ring-2 ring-sky-400" : ""}`} data-drop-column="diagnosticos_procedimientos">
              <h4 className="uppercase font-extrabold mb-2 text-center">DIAGNÓSTICO / PROCED.</h4>
              <div className="flex-1">
                {/* Placeholder para sombra preview cuando se hoverea (sólo si la columna está permitida) */}
                {allowedColumns.includes("diagnosticos_procedimientos") && hoverStatus === "diagnosticos_procedimientos" ? (
                  <div
                    className="mb-2 bg-white/20 rounded shadow p-2 transition-all duration-200"
                    style={placeholderHeight ? { height: `${placeholderHeight}px` } : undefined}
                  />
                ) : null}
                {diagnosticBeds.length > 0 ? diagnosticBeds.map((bed) => {
                  const assigned = patients.find((p) => p.bed_id === bed.id);
                  const isBedHighlight = hoverStatus === `bed-${bed.id}` || _highlightBedId === bed.id;
                  return (
                    <div
                      key={bed.id}
                      data-draggable-patient={assigned ? String(assigned.id) : undefined}
                      className={`card-item relative ${isBedHighlight ? "ring-2 ring-sky-400" : ""} border-l-4 border-blue-600 bg-blue-100/80`}
                    >
                      <div className="font-bold">CAMA {bed.id}</div>
                      <div className="text-md text-gray-700 font-semibold mt-0.5">Habit. {getRoomNumber(bed.room_id)}</div>
                      <div className="meta">{formatDate(bed.last_update)}</div>
                      {assigned ? (
                        <div className="mt-2 p-2 rounded flex flex-col gap-2 bg-blue-200/90">
                          <button
                            type="button"
                            className="font-medium mb-1 text-left w-full text-blue-800 hover:underline"
                            onClick={() => openProfile(assigned.id)}
                          >
                            {assigned.name}
                          </button>
                        </div>
                      ) : null}
                      <div className="absolute top-2 right-2 text-2xl text-blue-600 opacity-90 pointer-events-none">
                        <MdMedicalServices />
                      </div>
                    </div>
                  );
                }) : null}
              </div>
            </div>
          )}
          {/* Columna: Pre Egreso (pre-egreso) */}
          {canViewColumn("pre-egreso") && (
            <div
              className={`flex-shrink-0 w-64 md:flex-shrink md:w-auto bg-gray-200 rounded-lg p-4 min-h-[220px] flex flex-col ${allowedColumns.includes("pre-egreso") ? "ring-2 ring-sky-400" : ""}`}
              data-drop-column="pre-egreso"
            >
              <h4 className="uppercase font-extrabold mb-2 text-center">PRE-EGRESO</h4>
              <div className="flex-1">
                {/* Placeholder / sombra preview — solo si la columna está permitida en este drag */}
                {allowedColumns.includes("pre-egreso") && hoverStatus === "pre-egreso" ? (
                  <div
                    className="mb-2 bg-white/20 rounded shadow p-2 transition-all duration-200"
                    style={placeholderHeight ? { height: `${placeholderHeight}px` } : undefined}
                  />
                ) : null}
                {preEgresoBeds.length > 0 ? preEgresoBeds.map((bed) => {
                  const assigned = patients.find((p) => p.bed_id === bed.id);
                  const isBedHighlight = hoverStatus === `bed-${bed.id}` || _highlightBedId === bed.id;
                  return (
                    <div
                      key={bed.id}
                      data-draggable-patient={assigned ? String(assigned.id) : undefined}
                      className={`card-item relative ${isBedHighlight ? "ring-2 ring-sky-400" : ""} border-l-4 border-amber-600 bg-amber-100/80`}
                    >
                      <div className="font-bold">CAMA {bed.id}</div>
                      <div className="text-md text-gray-700 font-semibold mt-0.5">Habit. {getRoomNumber(bed.room_id)}</div>
                      <div className="meta">{formatDate(bed.last_update)}</div>
                      {assigned ? (
                        <div className="mt-2 p-2 rounded flex flex-col gap-2 bg-amber-200/90">
                          <button
                            type="button"
                            className="font-medium mb-1 text-left w-full text-amber-800 hover:underline"
                            onClick={() => openProfile(assigned.id)}
                          >
                            {assigned.name}
                          </button>
                        </div>
                      ) : null}
                      <div className="absolute top-2 right-2 text-2xl text-amber-600 opacity-90 pointer-events-none">
                        <IoExitOutline />
                      </div>
                    </div>
                  );
                }) : null}
              </div>
            </div>
          )}
          {/* Columna: Egreso (pacientes dados de alta) */}
          {canViewColumn("de alta") && (
            <div className={`flex-shrink-0 w-64 md:flex-shrink md:w-auto bg-gray-200 rounded-lg p-4 min-h-[220px] flex flex-col ${allowedColumns.includes("de alta") ? "ring-2 ring-sky-400" : ""}`} data-drop-column="de alta">
              <h4 className="uppercase font-extrabold mb-2 text-center">EGRESO</h4>
              <div className="flex-1">
                {/* Placeholder: use same color & padding as patient cards and match dragged rect height */}
                {allowedColumns.includes("de alta") && hoverStatus === "de alta" ? (
                  <div
                    className="mb-2 bg-white/20 rounded shadow p-2 transition-all duration-200"
                    style={placeholderHeight ? { height: `${placeholderHeight}px` } : undefined}
                  />
                ) : null}
                {dischargedPatients.map((p: Patient & { discharge_time?: string | null }) => (
                  <div key={p.id} className="card-item relative bg-teal-100/80 border-l-4 border-teal-600">
                    <button
                      type="button"
                      className="font-bold text-left w-full text-teal-800 hover:underline"
                      onClick={() => openProfile(p.id)}
                    >
                      {p.name}
                    </button>
                    {/* Mostrar hora y fecha en líneas separadas */}
                    <div className="meta font-semibold">Hora de salida:</div>
                    {p.discharge_time ? (
                      <>
                        <div className="meta">{to12Hour(new Date(p.discharge_time))}</div>
                        <div className="meta">{new Date(p.discharge_time).toLocaleString("en-US", { month: "short" }).toLowerCase()}, {new Date(p.discharge_time).getDate()}</div>
                      </>
                    ) : (
                      <div className="meta">—</div>
                    )}
                    <div className="absolute top-2 right-2 text-2xl text-teal-600 opacity-90 pointer-events-none">
                      <RiDoorOpenLine />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Columna final: Limpieza */}
          {canViewColumn("Limpieza") && (
            <div
              className={`flex-shrink-0 w-64 md:flex-shrink md:w-auto bg-gray-200 rounded-lg p-4 min-h-[220px] flex flex-col ${allowedColumns.includes("Limpieza") ? "ring-2 ring-sky-400" : ""}`}
              data-drop-column="Limpieza"
            >
              <h4 className="uppercase font-extrabold mb-2 text-center">LIMPIEZA</h4>
              <div className="flex-1">
                {/* Placeholder para preview cuando se arrastra una tarjeta de cama hacia Limpieza (sólo si está permitido) */}
                {allowedColumns.includes("Limpieza") && hoverStatus === "Limpieza" && _bedPlaceholder?.status === "Limpieza" ? (
                  <div
                    className="mb-2 bg-white/20 rounded shadow p-2 transition-all duration-200"
                    style={_bedPlaceholder?.height ? { height: `${_bedPlaceholder.height}px` } : undefined}
                  />
                ) : null}
                {statusGroups.Limpieza.map((bed) => {
                  const assigned = patients.find((p) => p.bed_id === bed.id);
                  const hasActivePatient = Boolean(assigned && getPatientEffectiveStatus(assigned) !== "de alta");
                  const isBedHighlight = hoverStatus === `bed-${bed.id}` || _highlightBedId === bed.id;
                  // compute CSS variable object without using `any`
                  const selectStyle = ({ ['--select-bg']: auxStatusColor(bed.aux_status ?? "Limpieza") } as unknown) as React.CSSProperties;
                  return (
                    <div
                      key={bed.id}
                      // permitir arrastrar camas en Limpieza hacia Disponible si no tienen paciente activo y no son Atención Médica
                      data-draggable-bed={!hasActivePatient && bed.status !== "Atención Médica" ? String(bed.id) : undefined}
                      data-drop-bed={String(bed.id)}
                      className={`card-item relative ${isBedHighlight ? "ring-2 ring-sky-400" : ""} bg-yellow-50 border-l-4 border-yellow-500`}
                    >
                      <div className="font-bold">CAMA {bed.id}</div>
                      <div className="text-md text-gray-700 mt-0.5">Habit. {getRoomNumber(bed.room_id)}</div>
                      <div className="meta">{formatDate(bed.last_update)}</div>

                      {/* Select only visible in Limpieza column to set aux_status */}
                      <div className="mt-2">
                        <label className="text-xs block mb-1">Estado limpieza</label>
                        <select
                          value={bed.aux_status ?? "Limpieza"}
                          onChange={async (e) => {
                            const val = e.target.value as AuxBedStatus;
                            // optimistic update
                            setBeds((prev) => prev.map((b) => (b.id === bed.id ? { ...b, aux_status: val } : b)));
                            try {
                              await fetch("/api/beds", {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: bed.id, aux_status: val }),
                              });
                              void mutate("/api/beds");
                            } catch (err) {
                              console.error("Error actualizando aux_status:", err);
                            }
                          }}
                          /* appearance-none + focus utilities to remove native blue halo; auxStatusClass still provides color classes */
                          className={`w-full rounded p-1 custom-select appearance-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ${auxStatusClass(bed.aux_status ?? "Limpieza")}`}
                          style={selectStyle}
                        >
                          <option value="Limpieza">Limpieza</option>
                          <option value="Mantenimiento">Mantenimiento</option>
                          <option value="Aislamiento">Aislamiento</option>
                          <option value="Reserva">Reserva</option>
                        </select>
                      </div>
                      {/* assigned info */}
                      <div className="absolute top-2 right-2 text-2xl text-yellow-600 opacity-90 pointer-events-none">
                        <MdOutlineCleaningServices />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modales (render fuera del flujo de columnas, al final del componente) */}
      {/* Diagnosis modal */}
      {
        openDiagFor !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpenDiagFor(null)} />
            <div className="relative bg-white text-black rounded p-4 w-full max-w-lg z-10">
              {/* Close X */}
              <button
                type="button"
                aria-label="Cerrar"
                className="absolute top-3 right-3 text-gray-600 hover:text-gray-900"
                onClick={() => setOpenDiagFor(null)}
              >
                ×
              </button>
              <h3 className="font-bold mb-2">Editar diagnóstico</h3>
              <div className="text-xs text-gray-600 mb-2">
                {diagSaving ? <>Guardando: {to12HourWithDate(new Date())}</> : <>Ahora: {to12HourWithDate(new Date())}</>}
              </div>
              {/* Reuse the DiagnosticoEditable component to avoid duplicated state/logic */}
              {typeof openDiagFor === "number" && (
                <DiagnosticoEditable
                  patientId={openDiagFor}
                  diagnosticNotes={diagnosticNotes}
                  setDiagnosticNotes={setDiagnosticNotes}
                  diagBlob={diagBlob}
                  setDiagBlob={setDiagBlob}
                  diagUrl={diagUrl}
                  setDiagUrl={setDiagUrl}
                  diagDuration={diagDuration}
                  setDiagDuration={setDiagDuration}
                  diagRecording={diagRecording}
                  setDiagRecording={setDiagRecording}
                  diagRecorderRef={diagRecorderRef}
                  diagChunksRef={diagChunksRef}
                  diagStartRef={diagStartRef}
                  diagSaving={diagSaving}
                  setDiagSaving={setDiagSaving}
                  saveDiagnosticNote={saveDiagnosticNote}
                />
              )}
            </div>
          </div>
        )
      }

      {/* Procedures modal */}
      {
        openProcFor !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpenProcFor(null)} />
            <div className="relative bg-white text-black rounded p-4 w-full max-w-lg z-10">
              {/* Close X */}
              <button
                type="button"
                aria-label="Cerrar"
                className="absolute top-3 right-3 text-gray-600 hover:text-gray-900"
                onClick={() => setOpenProcFor(null)}
              >
                ×
              </button>
              <h3 className="font-bold mb-2">Procedimientos</h3>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {(procList[openProcFor] ?? []).map((proc) => {
                  const isEditing = editingProcId === proc.id;
                  const isSavingThis = Boolean(procEditingSaving[proc.id]);
                  return (
                    <div key={proc.id} className="p-2 border rounded">
                      <div className="flex justify-between items-start gap-2">
                        <div className="text-xs text-gray-500">
                          {to12HourWithDate(proc.created_at)}
                        </div>
                        <div className="text-xs text-gray-400">#{proc.id}</div>
                      </div>
                      {/* Editar procedimiento: textarea si está editando, texto si no */}
                      {isEditing ? (
                        <textarea
                          className="w-full mt-2 p-2 border rounded"
                          value={editProcDesc[proc.id] ?? ""}
                          onChange={(e) =>
                            setEditProcDesc((prev) => ({ ...prev, [proc.id]: e.target.value }))
                          }
                        />
                      ) : (
                        <div className="mt-2">{proc.descripcion}</div>
                      )}
                      {proc.audio_url ? (
                        <div className="mt-2">
                          <audio controls src={proc.audio_url} className="w-full" />
                          <div className="text-xs text-gray-400">Audio adjunto</div>
                        </div>
                      ) : null}
                      <div className="mt-2 flex gap-2">
                        {isEditing ? (
                          <>
                            <button
                              className="px-3 py-1 rounded bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 min-w-[120px] flex items-center justify-center gap-2"
                              onClick={async () => {
                                // delegate to central handler (it toggles saving state)
                                await saveProcedureEdit(proc.id, openProcFor ?? openProfileFor ?? 0);
                              }}
                              disabled={isSavingThis}
                            >
                              {isSavingThis ? "Guardando..." : "Guardar"}
                            </button>
                            <button
                              className="px-3 py-1 rounded bg-gray-200"
                              onClick={() => {
                                setEditingProcId(null);
                                setEditProcDesc((prev) => ({ ...prev, [proc.id]: "" }));
                              }}
                            >
                              Cancelar
                            </button>
                            <button
                              className="px-3 py-1 rounded bg-red-600 text-white"
                              onClick={async () => {
                                await deleteProcedure(proc.id, openProcFor ?? openProfileFor ?? 0);
                              }}
                            >
                              Eliminar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="px-3 py-1 rounded bg-yellow-400 hover:bg-yellow-500 text-black"
                              onClick={() => {
                                setEditingProcId(proc.id);
                                setEditProcDesc((prev) => ({ ...prev, [proc.id]: proc.descripcion }));
                              }}
                            >
                              Editar
                            </button>
                            <button
                              className="px-3 py-1 rounded bg-red-600 text-white"
                              onClick={async () => {
                                await deleteProcedure(proc.id, openProcFor ?? openProfileFor ?? 0);
                              }}
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <textarea
                  className="w-full p-2 border rounded"
                  placeholder="Agregar nuevo procedimiento (texto)..."
                  value={procInput}
                  onChange={(e) => setProcInput(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 min-w-[170px] flex items-center justify-center gap-2"
                    onClick={async () => {
                      if (openProcFor) await addProcedure(openProcFor);
                    }}
                    disabled={!procInput.trim()}
                  >
                    Guardar procedimiento
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-gray-200"
                    onClick={() => setProcInput("")}
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Patient profile modal */}
      {
        openProfileFor !== null && (
          <div className="fixed inset-0 z-60 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpenProfileFor(null)} />
            <div className="relative bg-white text-black rounded p-4 w-full max-w-2xl z-70">
              {/* Close X */}
              <button
                type="button"
                aria-label="Cerrar"
                className="absolute top-3 right-3 text-rose-600 hover:text-rose-800 transition-all"
                onClick={() => setOpenProfileFor(null)}
                style={{ fontSize: "2rem", background: "none", border: "none", padding: 0, lineHeight: 1 }}
              >
                <RiCloseCircleLine size={32} />
              </button>
              {/* Menú de tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  className={`px-3 py-1 rounded font-semibold ${profileTab === "perfil" ? "bg-blue-600 text-white" : "bg-gray-400"}`}
                  onClick={() => setProfileTab("perfil")}
                >
                  Perfil paciente
                </button>
                <button
                  className={`px-3 py-1 rounded font-semibold ${profileTab === "diagnostico" ? "bg-indigo-600 text-white" : "bg-gray-400"}`}
                  onClick={() => setProfileTab("diagnostico")}
                >
                  Diagnóstico
                </button>
                <button
                  className={`px-3 py-1 rounded font-semibold ${profileTab === "procedimientos" ? "bg-emerald-600 text-white" : "bg-gray-200"}`}
                  onClick={() => {
                    setProfileTab("procedimientos");
                    if (openProfileFor) void loadProcedures(openProfileFor);
                  }}
                >
                  Procedimientos
                </button>
                {/* NUEVO: pestaña Pre-egreso */}
                <button
                  className={`px-6 py-1 rounded font-semibold ${profileTab === "pre-egreso" ? "bg-rose-600 text-white" : "bg-gray-200"}`}
                  onClick={() => setProfileTab("pre-egreso")}
                >
                  Pre-egreso
                </button>
              </div>
              {/* Contenido según tab */}
              {profileTab === "perfil" && (
                <div>
                  <h3 className="font-bold mb-2">Ficha del paciente</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <label className="block text-xs">Nombre</label>
                      <input
                        className="w-full p-1 border rounded"
                        value={profileForm.name ?? profilePatient?.name ?? ""}
                        onChange={(e) => setProfileForm((s) => ({ ...s, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs">Fecha de Nacimiento</label>
                      <input
                        type="date"
                        className="w-full p-1 border rounded"
                        value={profileForm.birth_date ?? ""}
                        onChange={(e) => setProfileForm((s) => ({ ...s, birth_date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs">Ciudad</label>
                      <input
                        className="w-full p-1 border rounded"
                        value={profileForm.city ?? ""}
                        onChange={(e) => setProfileForm((s) => ({ ...s, city: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs">Celular</label>
                      <input
                        className="w-full p-1 border rounded"
                        value={profileForm.phone ?? ""}
                        onChange={(e) => setProfileForm((s) => ({ ...s, phone: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs">Tipo de sangre</label>
                      <input
                        className="w-full p-1 border rounded"
                        value={profileForm.blood_type ?? ""}
                        onChange={(e) => setProfileForm((s) => ({ ...s, blood_type: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs">Comentario extra</label>
                      <textarea
                        className="w-full p-1 border rounded"
                        value={profileForm.extra_comment ?? ""}
                        onChange={(e) => setProfileForm((s) => ({ ...s, extra_comment: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                      onClick={() => {
                        setOpenProfileFor(null);
                      }}
                    >
                      Cerrar
                    </button>
                    <button
                      className="px-3 py-1 rounded bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
                      onClick={async () => {
                        if (!openProfileFor) return;
                        // construir body con sólo campos permitidos
                        const body: Record<string, unknown> = {};
                        if (typeof profileForm.name === "string") body.name = profileForm.name;
                        if (typeof profileForm.city === "string") body.city = profileForm.city;
                        if (typeof profileForm.phone === "string") body.phone = profileForm.phone;
                        if (typeof profileForm.blood_type === "string") body.blood_type = profileForm.blood_type;
                        if (typeof profileForm.birth_date === "string") body.birth_date = profileForm.birth_date; // string ISO YYYY-MM-DD
                        if (typeof profileForm.extra_comment === "string") body.extra_comment = profileForm.extra_comment;
                        try {
                          const res = await fetch(`/api/patients/${openProfileFor}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(body),
                          });
                          if (res.ok) {
                            void mutate("/api/patients");
                            setProfilePatient((prev) => ({ ...(prev ?? {}), ...(body as Partial<Patient>) } as Patient));
                            setOpenProfileFor(null);
                          } else {
                            console.error("PUT paciente falló:", await res.text());
                          }
                        } catch (err) {
                          console.error("Error guardando perfil:", err);
                        }
                      }}
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              )}
              {profileTab === "diagnostico" && (
                <div>
                  <h3 className="font-bold mb-2">Diagnóstico</h3>
                  <div className="text-xs text-gray-600 mb-2">
                    {diagSaving ? <>Guardando: {to12HourWithDate(new Date())}</> : <>Ahora: {to12HourWithDate(new Date())}</>}
                  </div>
                  {/* Estado de edición para diagnóstico */}
                  {typeof openProfileFor === "number" && (
                    <DiagnosticoEditable
                      patientId={openProfileFor}
                      diagnosticNotes={diagnosticNotes}
                      setDiagnosticNotes={setDiagnosticNotes}
                      diagBlob={diagBlob}
                      setDiagBlob={setDiagBlob}
                      diagUrl={diagUrl}
                      setDiagUrl={setDiagUrl}
                      diagDuration={diagDuration}
                      setDiagDuration={setDiagDuration}
                      diagRecording={diagRecording}
                      setDiagRecording={setDiagRecording}
                      diagRecorderRef={diagRecorderRef}
                      diagChunksRef={diagChunksRef}
                      diagStartRef={diagStartRef}
                      diagSaving={diagSaving}
                      setDiagSaving={setDiagSaving}
                      saveDiagnosticNote={saveDiagnosticNote}
                    />
                  )}
                </div>
              )}
              {profileTab === "procedimientos" && (
                <div>
                  <h3 className="font-bold mb-2">Procedimientos</h3>
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                    {(procList[openProfileFor ?? 0] ?? []).map((proc) => {
                      const isEditing = editingProcId === proc.id;
                      const isSavingThis = Boolean(procEditingSaving[proc.id]);
                      return (
                        <div key={proc.id} className="p-2 border rounded">
                          <div className="flex justify-between items-start gap-2">
                            <div className="text-xs text-gray-500">
                              {to12HourWithDate(proc.created_at)}
                            </div>
                            <div className="text-xs text-gray-400">#{proc.id}</div>
                          </div>
                          {/* Editar procedimiento: textarea si está editando, texto si no */}
                          {isEditing ? (
                            <textarea
                              className="w-full mt-2 p-2 border rounded"
                              value={editProcDesc[proc.id] ?? ""}
                              onChange={(e) =>
                                setEditProcDesc((prev) => ({ ...prev, [proc.id]: e.target.value }))
                              }
                            />
                          ) : (
                            <div className="mt-2">{proc.descripcion}</div>
                          )}
                          {proc.audio_url ? (
                            <div className="mt-2">
                              <audio controls src={proc.audio_url} className="w-full" />
                              <div className="text-xs text-gray-400">Audio adjunto</div>
                            </div>
                          ) : null}
                          <div className="mt-2 flex gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  className="px-3 py-1 rounded bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 min-w-[120px] flex items-center justify-center gap-2"
                                  onClick={async () => {
                                    // delegate to central handler (it toggles saving state)
                                    await saveProcedureEdit(proc.id, openProcFor ?? openProfileFor ?? 0);
                                  }}
                                  disabled={isSavingThis}
                                >
                                  {isSavingThis ? "Guardando..." : "Guardar"}
                                </button>
                                <button
                                  className="px-3 py-1 rounded bg-gray-200"
                                  onClick={() => {
                                    setEditingProcId(null);
                                    setEditProcDesc((prev) => ({ ...prev, [proc.id]: "" }));
                                  }}
                                >
                                  Cancelar
                                </button>
                                <button
                                  className="px-3 py-1 rounded bg-red-600 text-white"
                                  onClick={async () => {
                                    await deleteProcedure(proc.id, openProcFor ?? openProfileFor ?? 0);
                                  }}
                                >
                                  Eliminar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="px-3 py-1 rounded bg-yellow-400 hover:bg-yellow-500 text-black"
                                  onClick={() => {
                                    setEditingProcId(proc.id);
                                    setEditProcDesc((prev) => ({ ...prev, [proc.id]: proc.descripcion }));
                                  }}
                                >
                                  Editar
                                </button>
                                <button
                                  className="px-3 py-1 rounded bg-red-600 text-white"
                                  onClick={async () => {
                                    await deleteProcedure(proc.id, openProcFor ?? openProfileFor ?? 0);
                                  }}
                                >
                                  Eliminar
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    <textarea
                      className="w-full p-2 border rounded"
                      placeholder="Agregar nuevo procedimiento (texto)..."
                      value={procInput}
                      onChange={(e) => setProcInput(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 min-w-[170px] flex items-center justify-center gap-2"
                        onClick={async () => {
                          if (openProcFor) await addProcedure(openProcFor);
                        }}
                        disabled={!procInput.trim()}
                      >
                        Guardar procedimiento
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-gray-200"
                        onClick={() => setProcInput("")}
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* NUEVO: pestaña Pre-egreso */}
              {profileTab === "pre-egreso" && (
                <div>
                  <h3 className="font-bold mb-2">Pre-egreso</h3>
                  <div className="text-xs text-gray-600 mb-2">
                    {preEgresoSaving ? <>Guardando: {to12HourWithDate(new Date())}</> : <>Ahora: {to12HourWithDate(new Date())}</>}
                  </div>
                  {/* Estado de edición para pre-egreso */}
                  {typeof openProfileFor === "number" && (
                    <PreEgresoEditable
                      patientId={openProfileFor}
                      preEgresoNotes={preEgresoNotes}
                      setPreEgresoNotes={setPreEgresoNotes}
                      preEgresoBlob={preEgresoBlob}
                      setPreEgresoBlob={setPreEgresoBlob}
                      preEgresoUrl={preEgresoUrl}
                      setPreEgresoUrl={setPreEgresoUrl}
                      preEgresoDuration={preEgresoDuration}
                      setPreEgresoDuration={setPreEgresoDuration}
                      preEgresoRecording={preEgresoRecording}
                      setPreEgresoRecording={setPreEgresoRecording}
                      preEgresoRecorderRef={preEgresoRecorderRef}
                      preEgresoChunksRef={preEgresoChunksRef}
                      preEgresoStartRef={preEgresoStartRef}
                      preEgresoSaving={preEgresoSaving}
                      setPreEgresoSaving={setPreEgresoSaving}
                      savePreEgreso={savePreEgreso}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )
      }
    </div >
  );
}

// Helper: devuelve clases de color para aux_status (fondo + texto blanco)
function auxStatusClass(s?: AuxBedStatus | null) {
  switch (s) {
    case "Limpieza":
      return "bg-green-600 text-white";
    case "Mantenimiento":
      return "bg-blue-600 text-white";
    case "Aislamiento":
      return "bg-red-600 text-white";
    case "Reserva":
      return "bg-orange-600 text-white";
    default:
      return "bg-gray-200 text-white";
  }
}

// Nuevo helper: color hex para aplicar como --select-bg
function auxStatusColor(s?: AuxBedStatus | null) {
  switch (s) {
    case "Limpieza":
      return "#16a34a"; // green-600
    case "Mantenimiento":
      return "#2563eb"; // blue-600
    case "Aislamiento":
      return "#dc2626"; // red-600
    case "Reserva":
      return "#ac1f89"; // same as globals.css for Reserva
    default:
      return "#111827"; // gray-900 fallback
  }
}

// Componente editable para Diagnóstico
function DiagnosticoEditable(props: {
  patientId: number;
  diagnosticNotes: Record<number, string>;
  setDiagnosticNotes: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  diagBlob: Blob | null;
  setDiagBlob: (b: Blob | null) => void;
  diagUrl: string | null;
  setDiagUrl: (u: string | null) => void;
  diagDuration: number | null;
  setDiagDuration: (n: number | null) => void;
  diagRecording: boolean;
  setDiagRecording: (v: boolean) => void;
  diagRecorderRef: React.RefObject<MediaRecorder | null>;
  diagChunksRef: React.RefObject<BlobPart[]>;
  diagStartRef: React.RefObject<number | null>;
  diagSaving: boolean;
  setDiagSaving: (v: boolean) => void;
  saveDiagnosticNote: (
    patientId: number,
    text: string,
    audioBlob?: Blob,
    recordedAt?: string,
    durationSeconds?: number
  ) => Promise<void>;
}) {
  const { patientId, setDiagnosticNotes } = props;
  const [isEditing, setIsEditing] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function fetchDiagnostic() {
      const res = await fetch(`/api/patients/${patientId}`);
      if (!res.ok) return;
      const data: Partial<Patient> = await res.json();
      const value = typeof data.diagnosticos_procedimientos === "string" ? data.diagnosticos_procedimientos : "";
      if (!cancelled) {
        setDiagnosticNotes((prev) => ({ ...prev, [patientId]: value }));
        setIsEditing(!(value.trim().length > 0));
      }
    }
    fetchDiagnostic();
    return () => { cancelled = true; };
  }, [patientId, setDiagnosticNotes]);

  // Variable local para saber si hay texto guardado
  const hasSavedText = (props.diagnosticNotes[props.patientId] ?? "").trim().length > 0;

  return (
    <>
      <textarea
        className="w-full min-h-[120px] p-2 border rounded"
        value={props.diagnosticNotes[props.patientId] ?? ""}
        onChange={(e) => props.setDiagnosticNotes((prev: Record<number, string>) => ({ ...prev, [props.patientId]: e.target.value }))}
        disabled={!isEditing || props.diagSaving}
      />
      {/* Recording UI para diagnóstico */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`px-3 py-1 rounded ${props.diagRecording ? "bg-red-600 text-white" : "bg-gray-200"}`}
            onClick={async () => {
              // start / stop recording
              if (!props.diagRecording) {
                try {
                  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                  const mr = new MediaRecorder(stream);
                  props.diagRecorderRef.current = mr;
                  props.diagChunksRef.current = [];
                  props.diagStartRef.current = Date.now();
                  mr.ondataavailable = (ev) => props.diagChunksRef.current.push(ev.data);
                  mr.onstop = () => {
                    const blob = new Blob(props.diagChunksRef.current, { type: "audio/webm" });
                    props.setDiagBlob(blob);
                    const url = URL.createObjectURL(blob);
                    props.setDiagUrl(url);
                    const dur = props.diagStartRef.current ? Math.round((Date.now() - props.diagStartRef.current) / 1000) : null;
                    props.setDiagDuration(dur);
                  };
                  mr.start();
                  props.setDiagRecording(true);
                } catch (err) {
                  console.error("No se pudo acceder al micrófono:", err);
                }
              } else {
                props.diagRecorderRef.current?.stop();
                props.diagRecorderRef.current = null;
                props.setDiagRecording(false);
              }
            }}
            disabled={!isEditing || props.diagSaving}
          >
            {props.diagRecording ? "Detener" : "Grabar audio"}
          </button>
          {props.diagUrl ? (
            <audio controls src={props.diagUrl} className="w-48" />
          ) : null}
          {props.diagDuration ? <div className="text-xs text-gray-500">Duración: {Math.floor(props.diagDuration / 60)}:{String(props.diagDuration % 60).padStart(2, '0')}</div> : null}
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        {!isEditing && hasSavedText ? (
          <button
            className="px-3 py-1 rounded bg-yellow-500 text-black hover:bg-yellow-600"
            onClick={() => setIsEditing(true)}
          >
            Editar
          </button>
        ) : (
          <>
            <button
              className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
              onClick={() => {
                props.setDiagBlob(null);
                props.setDiagUrl(null);
                props.setDiagDuration(null);
              }}
              disabled={props.diagSaving}
            >
              Limpiar
            </button>
            <button
              className="px-3 py-1 rounded bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 min-w-[170px] flex items-center justify-center gap-2"
              onClick={async () => {
                props.setDiagSaving(true);
                try {
                  const text = props.diagnosticNotes[props.patientId] ?? "";
                  if (props.diagBlob) {
                    const recordedAt = new Date().toISOString();
                    await props.saveDiagnosticNote(props.patientId, text, props.diagBlob, recordedAt, props.diagDuration ?? undefined);
                  } else {
                    await props.saveDiagnosticNote(props.patientId, text);
                  }
                  props.setDiagBlob(null);
                  props.setDiagUrl(null);
                  props.setDiagDuration(null);
                  // --- CORREGIDO: mantener el texto guardado en el textarea ---
                  props.setDiagnosticNotes((prev: Record<number, string>) => ({ ...prev, [props.patientId]: text }));
                  setIsEditing(!(typeof text === "string" && text.trim().length > 0));
                } finally {
                  props.setDiagSaving(false);
                }
              }}
              disabled={props.diagSaving}
            >
              Guardar diagnóstico
            </button>
          </>
        )}
      </div>
    </>
  );
}

// Componente editable para Pre-egreso
function PreEgresoEditable(props: {
  patientId: number;
  preEgresoNotes: Record<number, string>;
  setPreEgresoNotes: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  preEgresoBlob: Blob | null;
  setPreEgresoBlob: (b: Blob | null) => void;
  preEgresoUrl: string | null;
  setPreEgresoUrl: (u: string | null) => void;
  preEgresoDuration: number | null;
  setPreEgresoDuration: (n: number | null) => void;
  preEgresoRecording: boolean;
  setPreEgresoRecording: (v: boolean) => void;
  preEgresoRecorderRef: React.RefObject<MediaRecorder | null>;
  preEgresoChunksRef: React.RefObject<BlobPart[]>;
  preEgresoStartRef: React.RefObject<number | null>;
  preEgresoSaving: boolean;
  setPreEgresoSaving: (v: boolean) => void;
  savePreEgreso: (
    patientId: number,
    text: string,
    audioBlob?: Blob,
    recordedAt?: string,
    durationSeconds?: number
  ) => Promise<void>;
}) {
  const { patientId, setPreEgresoNotes } = props;
  const [isEditing, setIsEditing] = useState(true);
  React.useEffect(() => {
    let cancelled = false;
    async function fetchPreEgreso() {
      const res = await fetch(`/api/pre_egresos?patientId=${patientId}`);
      if (!res.ok) return;
      const data: unknown = await res.json();
      let last = "";
      if (Array.isArray(data) && data.length > 0) {
        const lastItem = data[data.length - 1];
        // Tipar correctamente el elemento antes de acceder a .contenido
        if (
          lastItem &&
          typeof lastItem === "object" &&
          "contenido" in lastItem &&
          typeof (lastItem as { contenido?: unknown }).contenido === "string"
        ) {
          last = (lastItem as { contenido: string }).contenido;
        }
      }
      if (!cancelled) {
        setPreEgresoNotes((prev) => ({ ...prev, [patientId]: last }));
        setIsEditing(!(last.trim().length > 0));
      }
    }
    fetchPreEgreso();
    return () => { cancelled = true; };
  }, [patientId, setPreEgresoNotes]);

  return (
    <>
      <textarea
        className="w-full min-h-[120px] p-2 border rounded"
        value={props.preEgresoNotes[props.patientId] ?? ""}
        onChange={(e) => props.setPreEgresoNotes((prev: Record<number, string>) => ({ ...prev, [props.patientId]: e.target.value }))}
        disabled={!isEditing || props.preEgresoSaving}
      />
      {/* Recording UI para pre-egreso */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`px-3 py-1 rounded ${props.preEgresoRecording ? "bg-red-600 text-white" : "bg-gray-200"}`}
            onClick={async () => {
              if (!isEditing || props.preEgresoSaving) return;
              if (!props.preEgresoRecording) {
                try {
                  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                  const mr = new MediaRecorder(stream);
                  props.preEgresoRecorderRef.current = mr;
                  props.preEgresoChunksRef.current = [];
                  props.preEgresoStartRef.current = Date.now();
                  mr.ondataavailable = (ev: BlobEvent) => props.preEgresoChunksRef.current.push(ev.data as BlobPart);
                  mr.onstop = () => {
                    const blob = new Blob(props.preEgresoChunksRef.current as BlobPart[], { type: "audio/webm" });
                    props.setPreEgresoBlob(blob);
                    const url = URL.createObjectURL(blob);
                    props.setPreEgresoUrl(url);
                    const dur = props.preEgresoStartRef.current ? Math.round((Date.now() - props.preEgresoStartRef.current) / 1000) : null;
                    props.setPreEgresoDuration(dur);
                  };
                  mr.start();
                  props.setPreEgresoRecording(true);
                } catch (err) {
                  console.error("No se pudo acceder al micrófono:", err);
                }
              } else {
                props.preEgresoRecorderRef.current?.stop();
                props.preEgresoRecorderRef.current = null;
                props.setPreEgresoRecording(false);
              }
            }}
            disabled={!isEditing || props.preEgresoSaving}
          >
            {props.preEgresoRecording ? "Detener" : "Grabar audio"}
          </button>
          {props.preEgresoUrl ? (
            <audio controls src={props.preEgresoUrl} className="w-48" />
          ) : null}
          {props.preEgresoDuration ? <div className="text-xs text-gray-500">Duración: {Math.floor(props.preEgresoDuration / 60)}:{String(props.preEgresoDuration % 60).padStart(2, '0')}</div> : null}
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        {!isEditing ? (
          <button
            className="px-3 py-1 rounded bg-yellow-500 text-black hover:bg-yellow-600"
            onClick={() => setIsEditing(true)}
          >
            Editar
          </button>
        ) : (
          <>
            <button
              className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
              onClick={() => {
                props.setPreEgresoBlob(null);
                props.setPreEgresoUrl(null);
                props.setPreEgresoDuration(null);
              }}
              disabled={props.preEgresoSaving}
            >
              Limpiar
            </button>
            <button
              className="px-3 py-1 rounded bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 min-w-[220px] flex items-center justify-center gap-2"
              style={{ whiteSpace: "nowrap" }}
              onClick={async () => {
                props.setPreEgresoSaving(true);
                try {
                  const text = props.preEgresoNotes[props.patientId] ?? "";
                  if (props.preEgresoBlob) {
                    const recordedAt = new Date().toISOString();
                    await props.savePreEgreso(props.patientId, text, props.preEgresoBlob, recordedAt, props.preEgresoDuration ?? undefined);
                  } else {
                    await props.savePreEgreso(props.patientId, text);
                  }
                  props.setPreEgresoBlob(null);
                  props.setPreEgresoUrl(null);
                  props.setPreEgresoDuration(null);
                  // --- CORREGIDO: mantener el texto guardado en el textarea ---
                  props.setPreEgresoNotes((prev: Record<number, string>) => ({ ...prev, [props.patientId]: text }));
                  setIsEditing(!(typeof text === "string" && text.trim().length > 0));
                } finally {
                  props.setPreEgresoSaving(false);
                }
              }}
              disabled={props.preEgresoSaving}
            >
              Guardar pre-egreso
            </button>
          </>
        )}
      </div>
    </>
  );
}
