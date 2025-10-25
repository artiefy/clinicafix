"use client";
import React, { useEffect, useMemo, useState } from "react";

interface EpicrisisShape {
  motivo_consulta_hospitalizacion: { descripcion: string };
  diagnosticos: { descripcion: string; lista_diagnosticos: string[] };
  tratamientos: { descripcion: string; farmacologicos: string[]; no_farmacologicos: string[] };
  evolucion_paciente: {
    descripcion: string;
    tiempo_estimado_recuperacion: {
      por_medico?: string;
      estimacion_ia?: { metodo?: string; rango_probable?: string; observacion?: string };
    };
  };
  indicaciones_alta: { medico?: { descripcion?: string }; enfermeria?: { descripcion?: string } };
  recomendaciones_seguimiento: { descripcion?: string; citas_recomendadas?: string[] };
  alertas: { descripcion?: string; accion_ia?: string };
}

export default function EpicrisisModal({
  patientId,
  open,
  inline = false,
  onCloseAction,
  onSavedAction,
}: {
  patientId: number | null;
  open: boolean;
  inline?: boolean;
  onCloseAction?: () => void;
  onSavedAction?: () => void;
}) {
  // memoize empty so useEffect deps can include it safely
  const empty = useMemo<EpicrisisShape>(() => ({
    motivo_consulta_hospitalizacion: { descripcion: "" },
    diagnosticos: { descripcion: "", lista_diagnosticos: [] },
    tratamientos: { descripcion: "", farmacologicos: [], no_farmacologicos: [] },
    evolucion_paciente: {
      descripcion: "",
      tiempo_estimado_recuperacion: { por_medico: "", estimacion_ia: { metodo: "", rango_probable: "", observacion: "" } },
    },
    indicaciones_alta: { medico: { descripcion: "" }, enfermeria: { descripcion: "" } },
    recomendaciones_seguimiento: { descripcion: "", citas_recomendadas: [] },
    alertas: { descripcion: "", accion_ia: "" },
  }), []);

  const [loading, setLoading] = useState(false);
  const [epic, setEpic] = useState<EpicrisisShape>(empty);
  const [_existsId, set_ExistsId] = useState<number | null>(null);

  useEffect(() => {
    // Load when the component is requested either as overlay (open) or embedded (inline)
    if (!(open || inline) || !patientId) return;
    let cancelled = false;
    setLoading(true);

    fetch(`/api/epicrisis?patientId=${patientId}`)
      .then((r) => r.json())
      .then((rows: unknown) => {
        if (cancelled) return;
        if (Array.isArray(rows) && rows.length > 0) {
          const rec = rows[rows.length - 1] as unknown;
          if (rec && typeof rec === "object") {
            const recObj = rec as Record<string, unknown>;
            const idVal = typeof recObj.id === "number" ? recObj.id : (typeof recObj.id === "string" ? Number(recObj.id) : null);
            set_ExistsId(idVal ?? null);
            const text = recObj.epicrisis_text ?? recObj.epicrisis_data ?? null;
            try {
              const parsed = typeof text === "string" ? JSON.parse(text) : text;
              if (parsed && typeof parsed === "object") {
                setEpic(() => ({ ...empty, ...(parsed as Partial<EpicrisisShape>) }));
              } else {
                setEpic(empty);
              }
            } catch {
              setEpic(empty);
            }
            return;
          }
        }
        setEpic(empty);
        set_ExistsId(null);
      })
      .catch((e) => {
        console.error("Carga epicrisis:", e);
        setEpic(empty);
        set_ExistsId(null);
      })
      .finally(() => setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [open, inline, patientId, empty]);

  async function save() {
    if (!patientId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/epicrisis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: patientId, epicrisis: epic }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSavedAction?.();
      onCloseAction?.();
    } catch (err) {
      console.error("Guardar epicrisis:", err);
      alert("Error guardando epicrisis");
    } finally {
      setLoading(false);
    }
  }

  // don't render unless asked either inline or overlay and patientId present
  if (!(open || inline) || !patientId) return null;

  // Inline editor (no backdrop)
  if (inline) {
    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-bold">Epicrisis — Paciente #{patientId}</h4>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded bg-gray-200" onClick={() => onCloseAction?.()}>Cerrar</button>
            <button className="px-3 py-1 rounded bg-emerald-700 text-white" onClick={save} disabled={loading}>
              {loading ? "Guardando..." : "Guardar epicrisis"}
            </button>
          </div>
        </div>

        <div className="space-y-4 max-h-[56vh] overflow-y-auto text-sm">
          <section>
            <label className="block text-xs font-semibold">Motivo de consulta / hospitalización</label>
            <textarea className="w-full p-2 border rounded" value={epic.motivo_consulta_hospitalizacion.descripcion} onChange={(e) => setEpic((s) => ({ ...s, motivo_consulta_hospitalizacion: { descripcion: e.target.value } }))} />
          </section>

          <section>
            <label className="block text-xs font-semibold">Diagnósticos (descripcion)</label>
            <textarea className="w-full p-2 border rounded" value={epic.diagnosticos.descripcion} onChange={(e) => setEpic((s) => ({ ...s, diagnosticos: { ...s.diagnosticos, descripcion: e.target.value } }))} />
            <label className="block text-xs font-semibold mt-1">Lista de diagnósticos (una por línea)</label>
            <textarea className="w-full p-2 border rounded" value={epic.diagnosticos.lista_diagnosticos.join("\n")} onChange={(e) => setEpic((s) => ({ ...s, diagnosticos: { ...s.diagnosticos, lista_diagnosticos: e.target.value.split("\n").map(l => l.trim()).filter(Boolean) } }))} />
          </section>

          <section>
            <label className="block text-xs font-semibold">Tratamientos (descripcion)</label>
            <textarea className="w-full p-2 border rounded" value={epic.tratamientos.descripcion} onChange={(e) => setEpic((s) => ({ ...s, tratamientos: { ...s.tratamientos, descripcion: e.target.value } }))} />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="block text-xs">Farmacológicos (una por línea)</label>
                <textarea className="w-full p-2 border rounded" value={epic.tratamientos.farmacologicos.join("\n")} onChange={(e) => setEpic((s) => ({ ...s, tratamientos: { ...s.tratamientos, farmacologicos: e.target.value.split("\n").map(l => l.trim()).filter(Boolean) } }))} />
              </div>
              <div>
                <label className="block text-xs">No farmacológicos (una por línea)</label>
                <textarea className="w-full p-2 border rounded" value={epic.tratamientos.no_farmacologicos.join("\n")} onChange={(e) => setEpic((s) => ({ ...s, tratamientos: { ...s.tratamientos, no_farmacologicos: e.target.value.split("\n").map(l => l.trim()).filter(Boolean) } }))} />
              </div>
            </div>
          </section>

          <section>
            <label className="block text-xs font-semibold">Evolución del paciente</label>
            <textarea className="w-full p-2 border rounded" value={epic.evolucion_paciente.descripcion} onChange={(e) => setEpic((s) => ({ ...s, evolucion_paciente: { ...s.evolucion_paciente, descripcion: e.target.value } }))} />
            <label className="block text-xs mt-2">Tiempo estimado de recuperación (por médico)</label>
            <input className="w-full p-2 border rounded" value={epic.evolucion_paciente.tiempo_estimado_recuperacion.por_medico ?? ""} onChange={(e) => setEpic((s) => ({ ...s, evolucion_paciente: { ...s.evolucion_paciente, tiempo_estimado_recuperacion: { ...s.evolucion_paciente.tiempo_estimado_recuperacion, por_medico: e.target.value } } }))} />
          </section>

          <section>
            <label className="block text-xs font-semibold">Indicaciones al alta (Médico)</label>
            <textarea className="w-full p-2 border rounded" value={epic.indicaciones_alta.medico?.descripcion ?? ""} onChange={(e) => setEpic((s) => ({ ...s, indicaciones_alta: { ...s.indicaciones_alta, medico: { descripcion: e.target.value } } }))} />
            <label className="block text-xs font-semibold mt-2">Indicaciones al alta (Enfermería)</label>
            <textarea className="w-full p-2 border rounded" value={epic.indicaciones_alta.enfermeria?.descripcion ?? ""} onChange={(e) => setEpic((s) => ({ ...s, indicaciones_alta: { ...s.indicaciones_alta, enfermeria: { descripcion: e.target.value } } }))} />
          </section>

          <section>
            <label className="block text-xs font-semibold">Recomendaciones de seguimiento</label>
            <textarea className="w-full p-2 border rounded" value={epic.recomendaciones_seguimiento.descripcion ?? ""} onChange={(e) => setEpic((s) => ({ ...s, recomendaciones_seguimiento: { ...s.recomendaciones_seguimiento, descripcion: e.target.value } }))} />
            <label className="block text-xs mt-1">Citas recomendadas (una por línea)</label>
            <textarea className="w-full p-2 border rounded" value={(epic.recomendaciones_seguimiento.citas_recomendadas ?? []).join("\n")} onChange={(e) => setEpic((s) => ({ ...s, recomendaciones_seguimiento: { ...s.recomendaciones_seguimiento, citas_recomendadas: e.target.value.split("\n").map(l => l.trim()).filter(Boolean) } }))} />
          </section>

          <section>
            <label className="block text-xs font-semibold">Alertas / Observaciones</label>
            <textarea className="w-full p-2 border rounded" value={epic.alertas.descripcion ?? ""} onChange={(e) => setEpic((s) => ({ ...s, alertas: { ...s.alertas, descripcion: e.target.value } }))} />
            <label className="block text-xs mt-1">Acción IA recomendada (texto)</label>
            <input className="w-full p-2 border rounded" value={epic.alertas.accion_ia ?? ""} onChange={(e) => setEpic((s) => ({ ...s, alertas: { ...s.alertas, accion_ia: e.target.value } }))} />
          </section>

          <section className="text-xs text-gray-600">
            Nota: actualmente la epicrisis se guarda manualmente como estructura JSON. En próximas iteraciones se podrá
            autogenerar desde diagnóstico/procedimientos con un servicio IA.
          </section>
        </div>
      </div>
    );
  }

  // Full overlay modal
  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => onCloseAction?.()} />
      <div className="relative bg-white text-black rounded p-4 w-full max-w-3xl z-80">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-lg">Epicrisis — Paciente #{patientId}</h3>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded bg-gray-200" onClick={() => onCloseAction?.()}>Cerrar</button>
            <button className="px-3 py-1 rounded bg-emerald-700 text-white" onClick={save} disabled={loading}>
              {loading ? "Guardando..." : "Guardar epicrisis"}
            </button>
          </div>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto text-sm">
          <section>
            <label className="block text-xs font-semibold">Motivo de consulta / hospitalización</label>
            <textarea className="w-full p-2 border rounded" value={epic.motivo_consulta_hospitalizacion.descripcion} onChange={(e) => setEpic((s) => ({ ...s, motivo_consulta_hospitalizacion: { descripcion: e.target.value } }))} />
          </section>

          <section>
            <label className="block text-xs font-semibold">Diagnósticos (descripcion)</label>
            <textarea className="w-full p-2 border rounded" value={epic.diagnosticos.descripcion} onChange={(e) => setEpic((s) => ({ ...s, diagnosticos: { ...s.diagnosticos, descripcion: e.target.value } }))} />
            <label className="block text-xs font-semibold mt-1">Lista de diagnósticos (una por línea)</label>
            <textarea className="w-full p-2 border rounded" value={epic.diagnosticos.lista_diagnosticos.join("\n")} onChange={(e) => setEpic((s) => ({ ...s, diagnosticos: { ...s.diagnosticos, lista_diagnosticos: e.target.value.split("\n").map(l => l.trim()).filter(Boolean) } }))} />
          </section>

          <section>
            <label className="block text-xs font-semibold">Tratamientos (descripcion)</label>
            <textarea className="w-full p-2 border rounded" value={epic.tratamientos.descripcion} onChange={(e) => setEpic((s) => ({ ...s, tratamientos: { ...s.tratamientos, descripcion: e.target.value } }))} />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="block text-xs">Farmacológicos (una por línea)</label>
                <textarea className="w-full p-2 border rounded" value={epic.tratamientos.farmacologicos.join("\n")} onChange={(e) => setEpic((s) => ({ ...s, tratamientos: { ...s.tratamientos, farmacologicos: e.target.value.split("\n").map(l => l.trim()).filter(Boolean) } }))} />
              </div>
              <div>
                <label className="block text-xs">No farmacológicos (una por línea)</label>
                <textarea className="w-full p-2 border rounded" value={epic.tratamientos.no_farmacologicos.join("\n")} onChange={(e) => setEpic((s) => ({ ...s, tratamientos: { ...s.tratamientos, no_farmacologicos: e.target.value.split("\n").map(l => l.trim()).filter(Boolean) } }))} />
              </div>
            </div>
          </section>

          <section>
            <label className="block text-xs font-semibold">Evolución del paciente</label>
            <textarea className="w-full p-2 border rounded" value={epic.evolucion_paciente.descripcion} onChange={(e) => setEpic((s) => ({ ...s, evolucion_paciente: { ...s.evolucion_paciente, descripcion: e.target.value } }))} />
            <label className="block text-xs mt-2">Tiempo estimado de recuperación (por médico)</label>
            <input className="w-full p-2 border rounded" value={epic.evolucion_paciente.tiempo_estimado_recuperacion.por_medico ?? ""} onChange={(e) => setEpic((s) => ({ ...s, evolucion_paciente: { ...s.evolucion_paciente, tiempo_estimado_recuperacion: { ...s.evolucion_paciente.tiempo_estimado_recuperacion, por_medico: e.target.value } } }))} />
          </section>

          <section>
            <label className="block text-xs font-semibold">Indicaciones al alta (Médico)</label>
            <textarea className="w-full p-2 border rounded" value={epic.indicaciones_alta.medico?.descripcion ?? ""} onChange={(e) => setEpic((s) => ({ ...s, indicaciones_alta: { ...s.indicaciones_alta, medico: { descripcion: e.target.value } } }))} />
            <label className="block text-xs font-semibold mt-2">Indicaciones al alta (Enfermería)</label>
            <textarea className="w-full p-2 border rounded" value={epic.indicaciones_alta.enfermeria?.descripcion ?? ""} onChange={(e) => setEpic((s) => ({ ...s, indicaciones_alta: { ...s.indicaciones_alta, enfermeria: { descripcion: e.target.value } } }))} />
          </section>

          <section>
            <label className="block text-xs font-semibold">Recomendaciones de seguimiento</label>
            <textarea className="w-full p-2 border rounded" value={epic.recomendaciones_seguimiento.descripcion ?? ""} onChange={(e) => setEpic((s) => ({ ...s, recomendaciones_seguimiento: { ...s.recomendaciones_seguimiento, descripcion: e.target.value } }))} />
            <label className="block text-xs mt-1">Citas recomendadas (una por línea)</label>
            <textarea className="w-full p-2 border rounded" value={(epic.recomendaciones_seguimiento.citas_recomendadas ?? []).join("\n")} onChange={(e) => setEpic((s) => ({ ...s, recomendaciones_seguimiento: { ...s.recomendaciones_seguimiento, citas_recomendadas: e.target.value.split("\n").map(l => l.trim()).filter(Boolean) } }))} />
          </section>

          <section>
            <label className="block text-xs font-semibold">Alertas / Observaciones</label>
            <textarea className="w-full p-2 border rounded" value={epic.alertas.descripcion ?? ""} onChange={(e) => setEpic((s) => ({ ...s, alertas: { ...s.alertas, descripcion: e.target.value } }))} />
            <label className="block text-xs mt-1">Acción IA recomendada (texto)</label>
            <input className="w-full p-2 border rounded" value={epic.alertas.accion_ia ?? ""} onChange={(e) => setEpic((s) => ({ ...s, alertas: { ...s.alertas, accion_ia: e.target.value } }))} />
          </section>

          <section className="text-xs text-gray-600">
            Nota: actualmente la epicrisis se guarda manualmente como estructura JSON. En próximas iteraciones se podrá
            autogenerar desde diagnóstico/procedimientos con un servicio IA.
          </section>
        </div>
      </div>
    </div>
  );
}
