"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Link2, Loader2, Unlink } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormSection } from "@/components/business/form-section";

/**
 * A quién pertenece un negocio, para administración.
 *
 * Es la única puerta que da dueño a una ficha que no pasó por el alta del
 * perfil: un negocio creado a mano desde el panel nacía sin fila en
 * `business_owners`, y sin ella nadie podía entrar a su panel.
 *
 * Vincular **reemplaza** al dueño anterior (ver la ruta). Por eso el botón que
 * ya tiene dueño dice «Reemplazar» y no «Vincular»: el mismo botón con dos
 * efectos distintos es una trampa.
 */

interface Owner {
  id: string;
  name: string;
  email: string;
}

/* Las mismas clases del resto de formularios del proyecto, copiadas como en los
   demás sitios: dos usos no justifican un archivo compartido. */
const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-4 text-body text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";
const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/75";
const BOTON =
  "inline-flex h-11 cursor-pointer items-center gap-gap-xs rounded-full px-gap-lg font-lv-display text-small font-semibold transition-all duration-500 ease-outquint active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";

export function VinculoEditor({ placeId }: { placeId: string }) {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/vinculos?negocioId=${encodeURIComponent(placeId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((row: { owner: Owner | null }) => {
        if (alive) setOwner(row.owner);
      })
      /* Sin respuesta se deja el formulario como «sin dueño»: guardar entonces
         crea el vínculo, que es lo que hace falta para una ficha que aún no
         tiene ninguno. */
      .catch(() => {
        if (alive) setOwner(null);
      });
    return () => {
      alive = false;
    };
  }, [placeId]);

  const vincular = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/vinculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negocioId: placeId, email }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "No se pudo vincular el negocio.");
        return;
      }

      const row = (await res.json()) as { owner: Owner };
      setOwner(row.owner);
      setEmail("");
      toast.success(`Ahora lo lleva ${row.owner.name}.`);
    } catch {
      toast.error("No hubo respuesta del servidor. No se cambió nada.");
    } finally {
      setSaving(false);
    }
  }, [placeId, email]);

  const desvincular = useCallback(async () => {
    if (!owner) return;
    if (
      !window.confirm(
        `¿Quitar a ${owner.name} de este negocio? La ficha se queda publicada y sin dueño hasta que vincules a otra persona.`,
      )
    ) {
      return;
    }

    setUnlinking(true);
    try {
      const res = await fetch(
        `/api/admin/vinculos?negocioId=${encodeURIComponent(placeId)}`,
        { method: "DELETE" },
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "No se pudo desvincular.");
        return;
      }

      setOwner(null);
      toast.success("Negocio sin dueño. La ficha sigue publicada.");
    } catch {
      toast.error("No hubo respuesta del servidor. No se cambió nada.");
    } finally {
      setUnlinking(false);
    }
  }, [placeId, owner]);

  return (
    <FormSection
      title="Dueño del negocio"
      icon={<Link2 size={18} strokeWidth={1.8} />}
    >
      {owner ? (
        <>
          <p className="flex flex-wrap items-center gap-gap-xs text-meta text-ink-soft/75">
            <span className="inline-flex items-center gap-[6px] rounded-full border border-verde-200 bg-verde-50 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-verde-700">
              <BadgeCheck size={12} strokeWidth={2} />
              Con dueño
            </span>
            <span className="text-body text-ink">{owner.name}</span>
            <span>{owner.email}</span>
          </p>

          <p className="text-meta text-ink-soft/75">
            Este negocio aparece en el menú de esa cuenta y ella es quien puede
            editarlo.
          </p>
        </>
      ) : (
        <p className="text-meta text-ink-soft/75">
          Esta ficha no pertenece a nadie. Sin dueño, nadie puede editarla ni
          recibe los avisos de su plan.
        </p>
      )}

      <div className="flex flex-col gap-gap-xs">
        <label htmlFor="vnEmail" className={LABEL}>
          {owner ? "Vincular a otro correo" : "Correo del dueño"}
        </label>
        <input
          id="vnEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="dueno@correo.com"
          className={cn(INPUT, "cursor-text")}
        />
        <p className="text-meta text-ink-soft/75">
          La persona tiene que haber entrado a La Verde al menos una vez: el
          vínculo se hace contra su cuenta.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-gap-sm">
        <button
          type="button"
          onClick={() => void vincular()}
          disabled={saving || unlinking || email.trim() === ""}
          className={cn(BOTON, "bg-verde-400 text-verde-950 shadow-primary-halo hover:bg-verde-300")}
        >
          {saving ? (
            <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
          ) : (
            <Link2 size={16} strokeWidth={1.8} />
          )}
          {saving ? "Vinculando…" : owner ? "Reemplazar dueño" : "Vincular"}
        </button>

        {owner && (
          <button
            type="button"
            onClick={() => void desvincular()}
            disabled={saving || unlinking}
            className={cn(
              BOTON,
              "border border-ink/10 bg-white text-ink hover:border-destructive/30 hover:text-destructive",
            )}
          >
            {unlinking ? (
              <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
            ) : (
              <Unlink size={16} strokeWidth={1.8} />
            )}
            {unlinking ? "Quitando…" : "Quitar dueño"}
          </button>
        )}
      </div>
    </FormSection>
  );
}
