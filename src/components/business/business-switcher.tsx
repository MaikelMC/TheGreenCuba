"use client";

import { useRouter } from "next/navigation";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { puedeSalir } from "@/lib/unsaved-guard";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";

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

/* La caja del prototipo: fondo blanco, hairline, radio de 14 y sombra apenas
   perceptible. `w-auto` en escritorio y ancho completo en móvil, como el
   `.business-switch` del rediseño. */
const CAJA =
  "inline-flex w-auto max-w-full items-center gap-[9px] rounded-[14px] border border-ink/10 bg-white px-[13px] py-[10px] font-lv-display text-[13px] font-bold shadow-soft max-sm:w-full";

/**
 * El selector de negocio del panel.
 *
 * Existe porque una misma cuenta puede tener más de uno abierto: el negocio que
 * reclama en `business_owners` y el negocio de prueba, que no vive en la tabla
 * pero cuenta como suyo para quien puede verlo. Antes el panel resolvía
 * `ownId ?? fixture` y elegía uno para siempre — quien tenía negocio propio se
 * quedaba sin ver el de prueba, sin manera de llegar a él.
 *
 * Un solo desplegable y no una píldora por negocio: con dos o tres negocios la
 * fila de cajas competía con la cabecera por el ancho, y con cinco no habría
 * cabido. El prototipo usa una única caja con el negocio activo y un chevron.
 *
 * La elección viaja en `?negocio=`, no en un estado de React, por dos motivos:
 * sobrevive al `router.refresh()` que disparan los guardados y el cambio de
 * plan, y deja el negocio señalado en un marcador o en un enlace que se comparte.
 */
export function BusinessSwitcher({
  negocios,
  seleccionado,
  compact = false,
}: {
  negocios: NegocioPanel[];
  /** El `id` del negocio que se está enseñando ahora. */
  seleccionado: string;
  /**
   * La píldora de la cabecera del dashboard. Sin lista se pinta también con un
   * solo negocio: ahí es el estado de la ficha, no una elección entre varias.
   */
  compact?: boolean;
}) {
  const router = useRouter();
  /* En la lista de secciones un selector de una opción no se elige, solo ocupa
     sitio. En la cabecera sí: es donde se lee qué negocio está abierto. */
  if (!compact && negocios.length < 2) return null;

  const activo =
    negocios.find((negocio) => negocio.id === seleccionado) ?? negocios[0];
  if (!activo) return null;

  /* Cambiar de negocio desmonta la vista en curso, y las secciones con trabajo
     sin guardar (catálogo, ficha, ofertas) se apagan con ella: la guardia tiene
     que preguntar aquí también. Si dice que no, el desplegable no navega y el
     control sigue enseñando el negocio de antes. */
  const cambiar = (id: string) => {
    if (id === seleccionado) return;
    if (!puedeSalir()) return;
    router.push(`/business?negocio=${encodeURIComponent(id)}`);
  };

  /* La caja cerrada: icono, nombre y el estado en microtexto, como el
     `business-switch` del prototipo. Va en `<span>` porque el disparador es un
     botón y solo admite contenido de frase. */
  const caja = (negocio: NegocioPanel) => (
    <>
      <span className="grid size-[27px] shrink-0 place-items-center rounded-[9px] bg-verde-50 text-verde-600">
        <Check size={14} strokeWidth={2.6} />
      </span>
      <span className="flex min-w-0 items-center gap-[3px]">
        <span className="truncate">{negocio.nombre}</span>
        <small className="whitespace-nowrap text-[10px] font-extrabold uppercase tracking-[0.07em] text-ink-soft/60">
          {negocio.esPrueba ? "Prueba" : "Negocio activo"}
        </small>
      </span>
    </>
  );

  /* Con un solo negocio la caja es información, no un enlace a la misma
     página: se pinta sin chevron y sin desplegable. */
  if (compact && negocios.length === 1) {
    return <span className={CAJA}>{caja(activo)}</span>;
  }

  return (
    <div className={compact ? "max-sm:w-full" : "mb-gap-lg"}>
      {!compact && (
        <p className="mb-gap-xs font-lv-display text-meta font-semibold uppercase tracking-[0.1em] text-ink-soft/75">
          Estás en
        </p>
      )}
      <Select value={seleccionado} onValueChange={cambiar}>
        {/* Disparador propio y no el `SelectTrigger` compartido: aquel recorta
            a una línea sus hijos con `line-clamp`, que rompe la caja de icono y
            el microtexto. El resto del desplegable —portal, teclado, foco— sí
            es el del sistema. */}
        <SelectPrimitive.Trigger
          aria-label={`Cambiar de negocio (ahora: ${activo.nombre})`}
          className={cn(
            CAJA,
            "justify-between transition-colors duration-500 ease-outquint hover:border-verde-300 focus-visible:border-verde-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/30",
          )}
        >
          {caja(activo)}
          <SelectPrimitive.Icon asChild>
            <ChevronDown
              size={14}
              strokeWidth={2}
              className="shrink-0 text-ink-soft/60"
            />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectContent>
          {negocios.map((negocio) => (
            <SelectItem key={negocio.id} value={negocio.id}>
              {negocio.nombre}
              {negocio.esPrueba ? " · Prueba" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
