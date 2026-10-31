"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Zap,
  Server,
  Loader2,
} from "lucide-react";
import { StateView } from "@/components/ui/state-view";
import { LoadingState } from "@/components/ui/loading";
import type { AiVendor } from "@/lib/ai/providers-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ProviderDTO {
  id: string;
  name: string;
  vendor?: AiVendor;
  baseURL?: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  priority: number;
}

const EMPTY_FORM: Omit<ProviderDTO, "id"> = {
  name: "",
  vendor: "openai",
  baseURL: "",
  apiKey: "",
  model: "",
  enabled: true,
  priority: 1,
};

interface Preset {
  label: string;
  name: string;
  vendor: AiVendor;
  baseURL: string;
  model: string;
  hint: string;
}

/* `hint` existe para que el preset diga lo que trae, no solo cómo se llama: el
   mismo proveedor puede entrar por dos caminos distintos —Gemini admite
   `:generateContent` y también `/openai/chat/completions`— y solo uno de los
   dos sirve para el asistente. */
const PRESETS: Preset[] = [
  {
    label: "Mistral",
    name: "Mistral",
    vendor: "openai",
    baseURL: "https://api.mistral.ai/v1",
    model: "mistral-small-latest",
    hint: "OpenAI-compatible · plan gratis",
  },
  {
    label: "OpenRouter",
    name: "OpenRouter",
    vendor: "openai",
    baseURL: "https://openrouter.ai/api/v1",
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    hint: "OpenAI-compatible · modelos :free",
  },
  {
    label: "Gemini",
    name: "Gemini",
    vendor: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-flash-lite-latest",
    hint: "X-goog-api-key · :generateContent",
  },
  {
    label: "Groq",
    name: "Groq",
    vendor: "openai",
    baseURL: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-120b",
    hint: "OpenAI-compatible · gpt-oss-120b",
  },
  {
    label: "Gemini (asistente)",
    name: "Gemini (asistente)",
    vendor: "openai",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-flash-lite-latest",
    hint: "Mismo Gemini, por /chat/completions",
  },
];

const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-4 text-small text-ink placeholder:text-ink-soft/60 outline-none transition-[border-color,box-shadow] duration-300 ease-outquint focus:border-verde-400 focus:ring-4 focus:ring-verde-400/15";
const LABEL =
  "font-lv-display text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft/70";
const HINT = "text-[11px] leading-relaxed text-ink-soft/65";
const CARD = "bg-white border border-ink/5 rounded-3xl shadow-soft";

/* Ya no se manda `x-admin-key`: la sesión viaja en la cookie, que el navegador
   adjunta sola en las peticiones al mismo origen, y el servidor la verifica. */
function headers(): HeadersInit {
  return { "Content-Type": "application/json" };
}

/* Un solo interruptor para la lista y el formulario: el mismo control, el mismo
   tacto. La cápsula entera es el área táctil y el estado se anuncia con `role`,
   no solo con el color. */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-10 shrink-0 cursor-pointer rounded-full border-none p-0 transition-colors duration-300 ease-outquint",
        checked ? "bg-verde-400" : "bg-ink/10",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] size-[18px] rounded-full bg-white shadow-soft transition-all duration-300 ease-outquint",
          checked ? "left-[21px]" : "left-[3px]",
        )}
      />
    </button>
  );
}

export function ProviderManager() {
  const [providers, setProviders] = useState<ProviderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai-providers", { headers: headers() });
      if (!res.ok) throw new Error();
      setProviders((await res.json()) as ProviderDTO[]);
    } catch {
      toast.error("No se pudieron cargar los proveedores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError(null);
  }, []);

  const startEdit = useCallback((p: ProviderDTO) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      vendor: p.vendor ?? "openai",
      baseURL: p.baseURL ?? "",
      apiKey: "",
      model: p.model,
      enabled: p.enabled,
      priority: p.priority,
    });
    setFormError(null);
  }, []);

  const applyPreset = useCallback((preset: Preset) => {
    setForm((f) => ({
      ...f,
      name: preset.name,
      vendor: preset.vendor,
      baseURL: preset.baseURL,
      model: preset.model,
    }));
    setFormError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim() || !form.model.trim()) {
      setFormError("Nombre y modelo son obligatorios.");
      return;
    }
    if (!editingId && !form.apiKey.trim()) {
      setFormError("La API key es obligatoria al crear un proveedor.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        model: form.model.trim(),
        baseURL: form.baseURL?.trim() || undefined,
        apiKey: form.apiKey.trim() || undefined,
      };
      const res = editingId
        ? await fetch(`/api/admin/ai-providers/${editingId}`, {
            method: "PATCH",
            headers: headers(),
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/ai-providers", {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setFormError(data.error ?? "Error al guardar");
        return;
      }
      toast.success(editingId ? "Proveedor actualizado" : "Proveedor agregado");
      resetForm();
      load();
    } catch {
      setFormError("Error de red al guardar.");
    } finally {
      setSaving(false);
    }
  }, [form, editingId, load, resetForm]);

  const handleDelete = useCallback(
    async (p: ProviderDTO) => {
      if (!window.confirm(`¿Eliminar el proveedor "${p.name}"?`)) return;
      const res = await fetch(`/api/admin/ai-providers/${p.id}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (!res.ok) {
        toast.error("No se pudo eliminar");
        return;
      }
      toast.success(`Proveedor "${p.name}" eliminado`);
      if (editingId === p.id) resetForm();
      load();
    },
    [load, editingId, resetForm],
  );

  const handleToggle = useCallback(
    async (p: ProviderDTO, enabled: boolean) => {
      const res = await fetch(`/api/admin/ai-providers/${p.id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        toast.error("No se pudo actualizar el estado");
        return;
      }
      load();
    },
    [load],
  );

  const handleTest = useCallback(async (id: string) => {
    setTestingId(id);
    try {
      const res = await fetch("/api/admin/ai-providers/test", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ id }),
      });
      const data = (await res.json()) as { ok: boolean; detail?: string; error?: string };
      if (data.ok) {
        toast.success(data.detail ?? "Conexión exitosa");
      } else {
        toast.error(data.error ?? "Fallo de conexión");
      }
    } catch {
      toast.error("Error de red al probar");
    } finally {
      setTestingId(null);
    }
  }, []);

  const editing = editingId !== null;
  const activos = providers.filter((p) => p.enabled).length;

  return (
    <>
      <header className="mb-gap-lg">
        <p className="font-lv-display text-[11px] font-semibold uppercase tracking-[0.16em] text-verde-600">
          Inteligencia artificial
        </p>
        <div className="mt-gap-2xs flex flex-wrap items-end justify-between gap-gap-sm">
          <div className="max-w-[56ch]">
            <h1 className="font-lv-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">
              Proveedores de IA
            </h1>
            <p className="mt-gap-2xs text-small text-ink-soft/70">
              Claves de modelos para la búsqueda inteligente y el asistente. Se
              guardan solo en el servidor.
            </p>
          </div>
          {!loading && providers.length > 0 && (
            <span className="inline-flex items-center gap-gap-2xs rounded-full border border-verde-200 bg-verde-50 px-3 py-1 font-lv-display text-[11px] font-semibold text-verde-700">
              <span className="size-1.5 rounded-full bg-verde-500" />
              {activos} de {providers.length} activos
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-gap-md lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {/* Lista */}
        <section className={cn(CARD, "overflow-hidden")}>
          <div className="flex items-center justify-between gap-gap-sm border-b border-ink/5 px-gap-md py-gap-sm">
            <h2 className="font-lv-display text-small font-semibold text-ink">
              Conectados
            </h2>
            <span className="text-[11px] text-ink-soft/60">
              Se usan en orden de prioridad
            </span>
          </div>

          {loading ? (
            <div className="p-gap-md">
              <LoadingState label="Cargando proveedores…" />
            </div>
          ) : providers.length === 0 ? (
            <div className="p-gap-md">
              <StateView
                size="sm"
                icon={Server}
                title="Aún no hay proveedores configurados"
                description="Agrega uno para activar la búsqueda con IA."
              />
            </div>
          ) : (
            <div className="flex flex-col px-gap-sm py-gap-2xs">
              {providers.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  layout
                  className="border-b border-ink/5 px-gap-xs py-gap-sm last:border-b-0"
                >
                  <div className="flex items-start gap-gap-sm">
                    <div
                      className={cn(
                        "mt-0.5 size-10 rounded-xl border grid place-items-center shrink-0",
                        p.enabled
                          ? "bg-verde-50 border-verde-200/60 text-verde-600"
                          : "bg-sand-warm border-ink/5 text-ink-soft/60",
                      )}
                    >
                      <Server size={17} strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-gap-2xs">
                        <span className="font-lv-display text-small font-semibold text-ink truncate">
                          {p.name}
                        </span>
                        {/* Lo que separa a un proveedor de otro aquí es cómo hay
                            que hablarle, y eso lo dice `vendor`. La etiqueta
                            anterior leía `type`, que ya no existe y que además
                            siempre valía lo mismo: «compatible» para todo lo
                            que no fuera Gemini. */}
                        <span className="rounded-full border border-ink/10 px-1.5 py-[1px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft/70">
                          {p.vendor === "gemini" ? "gemini" : "openai-compatible"}
                        </span>
                        {!p.enabled && (
                          <span className="rounded-full border border-destructive/40 px-1.5 py-[1px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-destructive">
                            inactivo
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-lv-display text-[11px] text-ink-soft/70 truncate">
                        {p.model} · {p.apiKey}
                      </p>
                      {p.baseURL && (
                        <p className="font-lv-display text-[10px] text-ink-soft/50 truncate">
                          {p.baseURL}
                        </p>
                      )}
                    </div>
                    <Toggle
                      checked={p.enabled}
                      onChange={(value) => handleToggle(p, value)}
                      label={`Activar ${p.name}`}
                    />
                  </div>
                  <div className="mt-gap-xs flex items-center gap-gap-md pl-[52px]">
                    <button
                      type="button"
                      onClick={() => handleTest(p.id)}
                      disabled={testingId === p.id}
                      className="inline-flex items-center gap-1 font-lv-display text-meta font-medium text-verde-600 hover:text-verde-700 transition-colors duration-300 ease-outquint disabled:opacity-60"
                    >
                      {testingId === p.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Zap size={13} strokeWidth={1.8} />
                      )}
                      Probar conexión
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="inline-flex items-center gap-1 font-lv-display text-meta font-medium text-ink-soft/70 hover:text-verde-600 transition-colors duration-300 ease-outquint"
                    >
                      <Pencil size={13} strokeWidth={1.8} />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p)}
                      className="inline-flex items-center gap-1 font-lv-display text-meta font-medium text-ink-soft/70 hover:text-destructive transition-colors duration-300 ease-outquint"
                    >
                      <Trash2 size={13} strokeWidth={1.8} />
                      Eliminar
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Form */}
        <section className={cn(CARD, "overflow-hidden")}>
          <div className="flex items-start justify-between gap-gap-sm px-gap-md pb-gap-sm pt-gap-md">
            <div className="flex items-center gap-gap-sm">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-verde-200/60 bg-verde-50 text-verde-600">
                {editing ? (
                  <Pencil size={18} strokeWidth={1.8} />
                ) : (
                  <Plus size={20} strokeWidth={1.8} />
                )}
              </span>
              <div>
                <h2 className="font-lv-display text-body font-semibold text-ink">
                  {editing ? "Editar proveedor" : "Nuevo proveedor"}
                </h2>
                <p className="text-[11px] text-ink-soft/65">
                  {editing
                    ? "Deja la clave vacía para conservar la actual."
                    : "Elige un preset o rellena la conexión a mano."}
                </p>
              </div>
            </div>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="size-11 sm:size-9 rounded-full border border-ink/10 grid place-items-center shrink-0 text-ink-soft/70 hover:border-verde-300 hover:text-verde-600 hover:bg-verde-50 transition-colors duration-300 ease-outquint"
                aria-label="Cancelar edición"
              >
                <X size={15} strokeWidth={1.8} />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-gap-md px-gap-md pb-gap-md">
            {!editing && (
              <div className="flex flex-col gap-gap-xs">
                <div className="flex items-baseline justify-between gap-gap-sm">
                  <span className={LABEL}>Empezar con</span>
                  <span className="text-[10px] text-ink-soft/50">
                    Rellena URL y modelo
                  </span>
                </div>
                {/* El modelo no se pinta: al pulsar el preset cae en el
                    formulario y ahí se lee entero. Lo que distingue a los dos de
                    Gemini —`:generateContent` frente a `/chat/completions`— lo
                    dice el `title` y lo explica la ayuda del estilo de API. */}
                <div className="flex flex-wrap gap-gap-2xs">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      title={preset.hint}
                      onClick={() => applyPreset(preset)}
                      className="rounded-full border border-ink/10 bg-white px-3 py-1.5 font-lv-display text-[11px] font-semibold text-ink-soft/80 transition-colors duration-300 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-gap-sm sm:grid-cols-2">
              <div className="flex flex-col gap-gap-xs">
                <label htmlFor="pName" className={LABEL}>Nombre</label>
                <input
                  id="pName"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: OpenAI principal"
                  className={INPUT}
                />
              </div>

              <div className="flex flex-col gap-gap-xs">
                <label htmlFor="pVendor" className={LABEL}>Estilo de API</label>
                <Select
                  value={form.vendor ?? "openai"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, vendor: v as AiVendor }))
                  }
                >
                  <SelectTrigger id="pVendor">
                    <SelectValue placeholder="Estilo de API" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">
                      OpenAI-compatible (Bearer /chat/completions)
                    </SelectItem>
                    <SelectItem value="gemini">
                      Gemini (X-goog-api-key /generateContent)
                    </SelectItem>
                  </SelectContent>
                </Select>
                {/* El asistente del chat solo habla `/chat/completions`, así que
                    un proveedor en estilo Gemini queda fuera de él. */}
                <p className={HINT}>
                  Gemini cubre la búsqueda; el asistente necesita uno
                  OpenAI-compatible.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-gap-xs">
              <label htmlFor="pBase" className={LABEL}>Base URL</label>
              <input
                id="pBase"
                value={form.baseURL}
                onChange={(e) =>
                  setForm((f) => ({ ...f, baseURL: e.target.value }))
                }
                placeholder="https://api.ejemplo.com/v1"
                className={INPUT}
              />
              <p className={HINT}>
                {form.vendor === "gemini"
                  ? "Endpoint de Gemini: https://generativelanguage.googleapis.com/v1beta"
                  : "Vacía = https://api.openai.com/v1."}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-gap-sm sm:grid-cols-2">
              <div className="flex flex-col gap-gap-xs">
                <label htmlFor="pKey" className={LABEL}>API key</label>
                <input
                  id="pKey"
                  type="password"
                  autoComplete="new-password"
                  value={form.apiKey}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, apiKey: e.target.value }))
                  }
                  placeholder={editing ? "Dejar en blanco para conservar" : "sk-…"}
                  className={INPUT}
                />
              </div>

              <div className="flex flex-col gap-gap-xs">
                <label htmlFor="pModel" className={LABEL}>Modelo</label>
                <input
                  id="pModel"
                  value={form.model}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, model: e.target.value }))
                  }
                  placeholder="Ej: mistral-small-latest"
                  className={INPUT}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-gap-lg gap-y-gap-sm">
              <div className="flex items-center gap-gap-xs">
                <label htmlFor="pPriority" className={LABEL}>Prioridad</label>
                <input
                  id="pPriority"
                  type="number"
                  min={1}
                  title="La prioridad menor se intenta primero"
                  value={String(form.priority)}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      priority: Number(e.target.value) || 1,
                    }))
                  }
                  className="h-9 w-16 rounded-lg border border-ink/10 bg-white text-center font-lv-display text-small font-semibold text-ink outline-none transition-[border-color,box-shadow] duration-300 ease-outquint focus:border-verde-400 focus:ring-4 focus:ring-verde-400/15"
                />
              </div>

              <div className="flex h-9 items-center gap-gap-sm rounded-full border border-ink/5 bg-sand-warm/60 pl-3 pr-1.5">
                <span className="font-lv-display text-meta font-semibold text-ink">
                  Activo
                </span>
                <Toggle
                  checked={form.enabled}
                  onChange={(value) =>
                    setForm((f) => ({ ...f, enabled: value }))
                  }
                  label="Marcar proveedor como activo"
                />
              </div>
            </div>

            {formError && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/20 bg-destructive/5 px-gap-sm py-gap-xs text-meta font-medium text-destructive"
              >
                {formError}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="mt-gap-2xs inline-flex h-12 w-full items-center justify-center gap-gap-xs rounded-full bg-verde-400 font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition duration-300 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Plus size={18} strokeWidth={2} />
              )}
              {editing ? "Guardar cambios" : "Agregar proveedor"}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
