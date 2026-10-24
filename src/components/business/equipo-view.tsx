"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  PERMISOS_NEGOCIO,
  type PermisoNegocio,
} from "@/lib/permisos-negocio";

/**
 * El equipo del negocio: quién entra al panel y qué puede tocar cada uno.
 *
 * Solo el dueño llega aquí —la sección no existe en la barra del trabajador y
 * la ruta comprueba la propiedad otra vez—, pero eso no es lo que protege el
 * reparto: cada llamada a `/api/negocio/trabajadores` vuelve a comprobar quién
 * pregunta. Esta vista pinta y manda.
 *
 * Un trabajador se añade por correo porque tiene que tener cuenta: la fila de
 * `business_owners` apunta a `users.id`. Si todavía no entró a La Verde, el
 * servidor lo dice y aquí se enseña tal cual.
 */

interface Trabajador {
  userId: string;
  nombre: string;
  email: string;
  permisos: PermisoNegocio[];
}

const BOTON_PRIMARIO =
  "inline-flex h-11 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";

const INPUT =
  "h-11 w-full px-gap-sm border border-ink/10 rounded-xl font-lv text-body bg-white text-ink outline-none transition-colors duration-500 ease-outquint focus-visible:border-verde-400";

export function EquipoView({ placeId }: { placeId: string }) {
  const [lista, setLista] = useState<Trabajador[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [nuevos, setNuevos] = useState<PermisoNegocio[]>(["catalogo"]);
  const [añadiendo, setAñadiendo] = useState(false);
  const [guardando, setGuardando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/negocio/trabajadores?negocioId=${encodeURIComponent(placeId)}`,
      );
      const data = (await res.json().catch(() => ({}))) as {
        trabajadores?: Trabajador[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "No se pudo leer el equipo.");
        setLista([]);
        return;
      }
      setLista(data.trabajadores ?? []);
    } catch {
      setError("No se pudo leer el equipo. Revisa la conexión.");
      setLista([]);
    }
  }, [placeId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function alternarPermiso(marcados: PermisoNegocio[], clave: PermisoNegocio) {
    return marcados.includes(clave)
      ? marcados.filter((p) => p !== clave)
      : [...marcados, clave];
  }

  async function añadir() {
    if (añadiendo || !email.trim()) return;
    setAñadiendo(true);
    setError(null);

    try {
      const res = await fetch("/api/negocio/trabajadores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ negocioId: placeId, email, permisos: nuevos }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        trabajador?: Trabajador;
        error?: string;
      };
      if (!res.ok || !data.trabajador) {
        setError(data.error ?? "No se pudo añadir. Prueba otra vez.");
        return;
      }
      setLista((actual) => [...(actual ?? []), data.trabajador!]);
      setEmail("");
      setNuevos(["catalogo"]);
      toast.success("Trabajador añadido al equipo.");
    } catch {
      setError("No se pudo añadir. Revisa la conexión.");
    } finally {
      setAñadiendo(false);
    }
  }

  async function cambiarPermisos(
    trabajador: Trabajador,
    permisos: PermisoNegocio[],
  ) {
    /* Optimista, como los interruptores de Ajustes: se pinta la casilla nueva y
       si el servidor dice que no se devuelve. Una casilla que se queda marcada
       tras un fallo le diría al dueño que dio un permiso que no existe. */
    const antes = trabajador.permisos;
    setGuardando(trabajador.userId);
    setLista((actual) =>
      (actual ?? []).map((t) =>
        t.userId === trabajador.userId ? { ...t, permisos } : t,
      ),
    );

    try {
      const res = await fetch("/api/negocio/trabajadores", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          negocioId: placeId,
          userId: trabajador.userId,
          permisos,
        }),
      });
      if (!res.ok) {
        setLista((actual) =>
          (actual ?? []).map((t) =>
            t.userId === trabajador.userId ? { ...t, permisos: antes } : t,
          ),
        );
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "No se pudo guardar el permiso.");
        return;
      }
      setError(null);
    } catch {
      setLista((actual) =>
        (actual ?? []).map((t) =>
          t.userId === trabajador.userId ? { ...t, permisos: antes } : t,
        ),
      );
      setError("No se pudo guardar el permiso. Revisa la conexión.");
    } finally {
      setGuardando(null);
    }
  }

  async function quitar(trabajador: Trabajador) {
    if (
      !window.confirm(
        `¿Quitar a ${trabajador.nombre} del equipo? Perderá el acceso al panel.`,
      )
    ) {
      return;
    }

    setGuardando(trabajador.userId);
    try {
      const res = await fetch(
        `/api/negocio/trabajadores?negocioId=${encodeURIComponent(placeId)}&userId=${encodeURIComponent(trabajador.userId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "No se pudo quitar.");
        return;
      }
      setLista((actual) =>
        (actual ?? []).filter((t) => t.userId !== trabajador.userId),
      );
      toast.success(`${trabajador.nombre} ya no está en el equipo.`);
    } catch {
      setError("No se pudo quitar. Revisa la conexión.");
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="flex flex-col gap-gap-md">
      <h1 className="sr-only">Equipo</h1>

      <section className="rounded-2xl border border-ink/5 bg-white p-gap-md">
        <h2 className="flex items-center gap-gap-xs font-lv-display text-body font-semibold text-ink">
          <Users size={18} strokeWidth={1.8} className="text-verde-600" />
          Añadir trabajador
        </h2>
        <p className="mt-gap-xs max-w-[62ch] text-small text-ink-soft/75">
          La persona tiene que haber entrado a La Verde al menos una vez. Marca
          lo que podrá hacer; siempre entra al panel con su propia cuenta.
        </p>

        <div className="mt-gap-md flex flex-col gap-gap-sm border-t border-ink/5 pt-gap-sm">
          <div className="flex flex-col gap-gap-xs sm:flex-row sm:items-center">
            <label htmlFor="equipoEmail" className="sr-only">
              Correo del trabajador
            </label>
            <input
              id="equipoEmail"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className={INPUT}
            />
            <button
              type="button"
              onClick={() => void añadir()}
              disabled={añadiendo || !email.trim()}
              className={cn(BOTON_PRIMARIO, "shrink-0")}
            >
              {añadiendo ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} strokeWidth={2} />
              )}
              {añadiendo ? "Añadiendo…" : "Añadir"}
            </button>
          </div>

          <Casillas
            marcados={nuevos}
            onToggle={(clave) =>
              setNuevos((actual) => alternarPermiso(actual, clave))
            }
            deshabilitado={añadiendo}
          />
        </div>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-[7px] text-meta font-medium text-ink"
        >
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-ink/5 bg-white p-gap-md">
        <h2 className="font-lv-display text-body font-semibold text-ink">
          En el equipo
        </h2>

        {lista === null ? (
          <p className="mt-gap-sm flex items-center gap-gap-xs text-small text-ink-soft/75">
            <Loader2 size={16} className="animate-spin" />
            Leyendo el equipo…
          </p>
        ) : lista.length === 0 ? (
          <p className="mt-gap-sm text-small text-ink-soft/75">
            Todavía no hay trabajadores. Solo entras tú.
          </p>
        ) : (
          <ul className="mt-gap-sm flex flex-col divide-y divide-ink/5">
            {lista.map((trabajador) => (
              <li
                key={trabajador.userId}
                className="flex flex-col gap-gap-sm py-gap-sm first:pt-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-gap-sm">
                  <div className="min-w-0">
                    <p className="font-lv-display text-small font-semibold text-ink">
                      {trabajador.nombre}
                    </p>
                    <p className="break-words text-meta text-ink-soft/75">
                      {trabajador.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void quitar(trabajador)}
                    disabled={guardando === trabajador.userId}
                    className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-meta font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Trash2 size={14} strokeWidth={1.8} />
                    Quitar
                  </button>
                </div>

                <Casillas
                  compacto
                  marcados={trabajador.permisos}
                  onToggle={(clave) =>
                    void cambiarPermisos(
                      trabajador,
                      alternarPermiso(trabajador.permisos, clave),
                    )
                  }
                  deshabilitado={guardando === trabajador.userId}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Las cuatro casillas. Se usan al añadir y en cada fila del equipo. */
function Casillas({
  marcados,
  onToggle,
  deshabilitado,
  compacto = false,
}: {
  marcados: PermisoNegocio[];
  onToggle: (clave: PermisoNegocio) => void;
  deshabilitado?: boolean;
  compacto?: boolean;
}) {
  return (
    <ul className="grid gap-gap-xs sm:grid-cols-2">
      {PERMISOS_NEGOCIO.map((permiso) => {
        const activo = marcados.includes(permiso.clave);
        return (
          <li key={permiso.clave}>
            <button
              type="button"
              role="checkbox"
              aria-checked={activo}
              onClick={() => onToggle(permiso.clave)}
              disabled={deshabilitado}
              className={cn(
                "flex w-full cursor-pointer items-start gap-gap-xs rounded-xl border px-gap-sm py-gap-sm text-left transition-colors duration-300 disabled:pointer-events-none disabled:opacity-50",
                activo
                  ? "border-verde-200 bg-verde-50/70"
                  : "border-ink/10 bg-white hover:bg-sand",
              )}
            >
              <span
                className={cn(
                  "mt-[2px] grid size-[18px] shrink-0 place-items-center rounded-[5px] border text-[11px] font-bold",
                  activo
                    ? "border-verde-400 bg-verde-400 text-verde-950"
                    : "border-ink/20 bg-white text-transparent",
                )}
                aria-hidden="true"
              >
                ✓
              </span>
              <span className="min-w-0">
                <span className="block font-lv-display text-small font-semibold text-ink">
                  {permiso.label}
                </span>
                {!compacto && (
                  <span className="mt-[2px] block text-meta text-ink-soft/75">
                    {permiso.descripcion}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
