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
  Cpu,
  Server,
  Loader2,
} from "lucide-react";
import { getAdminKey } from "@/lib/admin-auth";
import { StateView } from "@/components/ui/state-view";
import { LoadingState } from "@/components/ui/loading";
import type {
  AiProviderType,
  AiVendor,
} from "@/lib/ai/providers-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  type: AiProviderType;
  vendor?: AiVendor;
  baseURL?: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  priority: number;
}

const EMPTY_FORM: Omit<ProviderDTO, "id"> = {
  name: "",
  type: "custom",
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
  type: AiProviderType;
  vendor: AiVendor;
  baseURL: string;
  model: string;
  hint: string;
}

const PRESETS: Preset[] = [
  {
    label: "Mistral",
    name: "Mistral",
    type: "custom",
    vendor: "openai",
    baseURL: "https://api.mistral.ai/v1",
    model: "mistral-small-latest",
    hint: "OpenAI-compatible · plan gratis",
  },
  {
    label: "OpenRouter",
    name: "OpenRouter",
    type: "custom",
    vendor: "openai",
    baseURL: "https://openrouter.ai/api/v1",
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    hint: "OpenAI-compatible · modelos :free",
  },
  {
    label: "Gemini",
    name: "Gemini",
    type: "custom",
    vendor: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-flash-latest",
    hint: "X-goog-api-key · :generateContent",
  },
];

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-admin-key": getAdminKey(),
  };
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
      type: p.type,
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
      type: preset.type,
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

  return (
    <>
      <div className="flex items-center justify-between gap-gap-sm mb-gap-lg">
        <div>
          <h1 className="font-display text-h3 font-bold text-foreground">
            Proveedores de IA
          </h1>
          <p className="text-small text-muted-foreground mt-gap-2xs">
            Claves de modelos para la búsqueda inteligente y el asistente. Se
            guardan solo en el servidor.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
        {/* List */}
        <div className="bg-surface border border-border rounded-lv-lg p-gap-md">
          {loading ? (
            <LoadingState label="Cargando proveedores…" />
          ) : providers.length === 0 ? (
            <StateView
              size="sm"
              icon={Server}
              title="Aún no hay proveedores configurados"
              description="Agrega uno para activar la búsqueda con IA."
            />
          ) : (
            <div className="flex flex-col">
              {providers.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  layout
                  className="py-gap-sm border-b border-border last:border-b-0"
                >
                  <div className="flex items-center gap-gap-sm">
                    <div
                      className={cn(
                        "size-9 rounded-lv grid place-items-center shrink-0",
                        p.enabled
                          ? "bg-accent/10 text-accent"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {p.type === "custom" ? (
                        <Server size={17} strokeWidth={1.8} />
                      ) : (
                        <Cpu size={17} strokeWidth={1.8} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-[6px]">
                        <span className="font-display text-small font-semibold text-foreground truncate">
                          {p.name}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide rounded-full border border-border px-1.5 py-[1px] text-muted-foreground">
                          {p.vendor === "gemini" ? "gemini" : p.type === "custom" ? "compatible" : "openai"}
                        </span>
                        {!p.enabled && (
                          <span className="text-[10px] uppercase tracking-wide rounded-full border border-destructive/40 text-destructive px-1.5 py-[1px]">
                            inactivo
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground truncate">
                        {p.model} · {p.apiKey}
                        {p.baseURL ? ` · ${p.baseURL}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle(p, !p.enabled)}
                      role="switch"
                      aria-checked={p.enabled}
                      aria-label={`Activar ${p.name}`}
                      className={cn(
                        "w-10 h-6 rounded-full shrink-0 transition-colors relative",
                        p.enabled ? "bg-accent" : "bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-[3px] size-[18px] rounded-full bg-white transition-all",
                          p.enabled ? "left-[21px]" : "left-[3px]",
                        )}
                      />
                    </button>
                  </div>
                  <div className="flex items-center gap-[6px] mt-gap-xs ml-[44px]">
                    <button
                      type="button"
                      onClick={() => handleTest(p.id)}
                      disabled={testingId === p.id}
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
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
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Pencil size={13} strokeWidth={1.8} />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p)}
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={13} strokeWidth={1.8} />
                      Eliminar
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Form */}
        <div className="bg-surface border border-border rounded-lv-lg p-gap-md h-fit">
          <div className="flex items-center justify-between mb-gap-sm">
            <h3 className="font-display text-body font-semibold text-foreground">
              {editing ? "Editar proveedor" : "Nuevo proveedor"}
            </h3>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="size-8 rounded-full border border-border grid place-items-center text-muted-foreground hover:border-accent hover:text-accent transition-colors"
                aria-label="Cancelar edición"
              >
                <X size={15} strokeWidth={2} />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-gap-sm">
            {!editing && (
              <div className="flex flex-wrap gap-gap-2xs">
                {PRESETS.map((preset, i) => (
                  <motion.button
                    key={preset.label}
                    type="button"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => applyPreset(preset)}
                    className="inline-flex flex-col items-start gap-[2px] rounded-lv-md border border-border px-[10px] py-[6px] text-left hover:border-accent/50 hover:bg-accent/5 transition-colors"
                  >
                    <span className="text-[12px] font-semibold text-foreground">
                      {preset.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {preset.model}
                    </span>
                  </motion.button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="pName">Nombre</Label>
              <Input
                id="pName"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: OpenAI principal"
              />
            </div>

            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="pType">Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, type: v as AiProviderType }))
                }
              >
                <SelectTrigger id="pType">
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">
                    Compatible (base URL personalizada)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="pVendor">Estilo de API</Label>
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
              <p className="text-[11px] text-muted-foreground">
                Elige según el proveedor. Los presets lo configuran automáticamente.
              </p>
            </div>

            {(form.type === "custom" || form.vendor === "gemini") && (
              <div className="flex flex-col gap-gap-xs">
                <Label htmlFor="pBase">Base URL</Label>
                <Input
                  id="pBase"
                  value={form.baseURL}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, baseURL: e.target.value }))
                  }
                  placeholder="https://api.ejemplo.com/v1"
                />
                <p className="text-[11px] text-muted-foreground">
                  {form.vendor === "gemini"
                    ? "Base URL de Gemini (p. ej. .../v1beta)."
                    : "Endpoint compatible con OpenAI (debe terminar en /v1)."}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="pKey">API key</Label>
              <Input
                id="pKey"
                type="password"
                autoComplete="new-password"
                value={form.apiKey}
                onChange={(e) =>
                  setForm((f) => ({ ...f, apiKey: e.target.value }))
                }
                placeholder={editing ? "Dejar en blanco para conservar" : "sk-..."}
              />
            </div>

            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="pModel">Modelo</Label>
              <Input
                id="pModel"
                value={form.model}
                onChange={(e) =>
                  setForm((f) => ({ ...f, model: e.target.value }))
                }
                placeholder="Ej: mistral-small-latest"
              />
            </div>

            <div className="grid grid-cols-2 gap-gap-sm">
              <div className="flex flex-col gap-gap-xs">
                <Label htmlFor="pPriority">Prioridad</Label>
                <Input
                  id="pPriority"
                  type="number"
                  min={1}
                  value={String(form.priority)}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      priority: Number(e.target.value) || 1,
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-gap-xs justify-end">
                <label className="inline-flex items-center gap-2 text-small text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, enabled: e.target.checked }))
                    }
                    className="size-4 accent-accent"
                  />
                  Activo (primer proveedor activo con menor prioridad se usa)
                </label>
              </div>
            </div>

            {formError && (
              <p className="text-[12px] text-destructive font-medium">{formError}</p>
            )}

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="w-full mt-gap-xs"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Plus size={18} strokeWidth={1.5} />
              )}
              {editing ? "Guardar cambios" : "Agregar proveedor"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
