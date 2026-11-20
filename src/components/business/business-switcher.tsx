"use client";

import { useRouter } from "next/navigation";
import { Check, Store } from "lucide-react";
import { clsx } from "clsx";
import { puedeSalir } from "@/lib/unsaved-guard";
import type { Destino } from "./panel-nav";

/**
 * Un negocio que se puede abrir en el panel.
 *
 * `esPrueba` distingue el negocio de prueba de los reales. No es decoración: el
 * fixture no está en `places` y sus datos no son de nadie, así que confundirlo
 * con un negocio propio al editar sería escribir en la ficha equivocada.
 */
export interface NegocioPanel {
  id: string;
  nombre: string;
  esPrueba: boolean;
}

/**
 * La lista «Tus negocios», que va dentro de la hoja que abre el nombre del
 * negocio en la barra superior.
 *
 * Antes era un desplegable encima de cada vista («Estás en…») y en la cabecera
 * del dashboard. Ahora vive en un solo sitio y solo existe con dos o más
 * negocios: con uno, el nombre de la barra no es tocable.
 *
 * La elección viaja en `?negocio=`, no en un estado de React: sobrevive al
 * `router.refresh()` que disparan los guardados y deja el negocio señalado en
 * un marcador. Se conserva la sección (y la subsección) en la que se estaba; si
 * esta cuenta no puede abrirla en el otro negocio, el armazón cae a Hoy.
 *
 * `router.replace` y no `push`: la entrada de la hoja ya está en el historial,
 * y el atrás tiene que volver a la pantalla de antes, no a la hoja.
 */
export function ListaNegocios({
  negocios,
  seleccionado,
  destino,
  onCerrar,
}: {
  negocios: NegocioPanel[];
  seleccionado: string;
  destino: Destino;
  onCerrar: () => void;
}) {
  const router = useRouter();

  const cambiar = (id: string) => {
    if (id === seleccionado) {
      onCerrar();
      return;
    }
    /* Cambiar de negocio desmonta la vista en curso, y las secciones con
       trabajo sin guardar se apagan con ella: la guardia pregunta aquí. */
    if (!puedeSalir()) return;
    const params = new URLSearchParams({ negocio: id });
    if (destino.seccion !== "dashboard") params.set("seccion", destino.seccion);
    if (destino.sub) params.set("sub", destino.sub);
    router.replace(`/business?${params.toString()}`);
  };

  return (
    <ul className="flex flex-col gap-gap-xs">
      {negocios.map((negocio) => {
        const activo = negocio.id === seleccionado;
        return (
          <li key={negocio.id}>
            <button
              type="button"
              onClick={() => cambiar(negocio.id)}
              aria-current={activo ? "true" : undefined}
              className={clsx(
                "flex min-h-11 w-full cursor-pointer items-center gap-gap-sm rounded-2xl border px-gap-md py-gap-xs text-left transition-colors duration-500 ease-outquint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40",
                activo
                  ? "border-verde-200 bg-verde-50"
                  : "border-ink/10 bg-white hover:border-verde-300",
              )}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-verde-50 text-verde-600">
                <Store size={18} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-lv-display text-small font-semibold text-ink">
                  {negocio.nombre}
                </span>
                <span className="block text-meta text-ink-soft/75">
                  {negocio.esPrueba ? "Negocio de prueba" : "Tu negocio"}
                </span>
              </span>
              {activo && (
                <Check size={18} strokeWidth={2} className="shrink-0 text-verde-600" aria-hidden />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
