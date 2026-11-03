"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  estadoApertura as calcularEstado,
  estadoDesdeTexto,
  type Horario,
} from "@/lib/ficha/horario";
import { COPY, textoEstado } from "@/config/ficha";

/**
 * «Abierto · Cierra a las 6:00 p. m.» / «Cerrado · Abre mañana a las 8».
 *
 * Es un componente de cliente porque el estado cambia mientras la página está
 * abierta y la ficha se sirve desde una caché de cinco minutos. El HTML inicial
 * sale correcto —el «ahora» del servidor llega en `nowIso`— y a partir de ahí se
 * recalcula cada minuto en el navegador.
 *
 * Si no hay horario estructurado se usa el heurístico de `schedule`, que es lo
 * único que tienen las fichas antiguas. Y si tampoco hay `schedule`, no se pinta
 * nada: inventar «Cerrado» sería afirmar algo que el negocio no dijo.
 */
export function EstadoApertura({
  horario,
  status,
  cerradoMensaje,
  schedule,
  nowIso,
  className,
}: {
  horario: Horario | null;
  status: "active" | "closed" | "temporary_closed";
  cerradoMensaje?: string | null;
  schedule?: string;
  nowIso?: string;
  className?: string;
}) {
  const [now, setNow] = useState(() =>
    nowIso ? new Date(nowIso) : new Date(),
  );

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const estado = calcularEstado({
    horario,
    status,
    mensajeCierre:
      cerradoMensaje?.trim() ||
      (status === "active" ? null : COPY.cerradoTemporal),
    now,
  });

  /* Ficha antigua: sin `horario`, se lee el `schedule` escrito a mano. Solo se
     afirma «abierto» o «cerrado» cuando el texto trae una hora comprobable. */
  if (estado.sinHorario && status === "active") {
    const texto = schedule?.trim();
    if (!texto) return null;
    const leido = estadoDesdeTexto(texto, now);

    /* «Lun-Sáb 9 a 6», «Llamar antes»: se enseña el horario tal cual, sin punto
       de color. Antes cualquier texto que no fuera «De día» o «De noche» se
       daba por abierto, así que un negocio que cerraba a las seis salía en
       verde a medianoche. Mejor el dato que el dueño escribió, sin veredicto. */
    if (leido.estado === "desconocido") {
      return (
        <span
          className={cn(
            "font-lv-display text-small font-semibold text-ink-soft/75",
            className,
          )}
        >
          {texto}
        </span>
      );
    }

    const abierto = leido.estado === "abierto";
    return (
      <EstadoLinea
        abierto={abierto}
        texto={`${abierto ? COPY.abierto : COPY.cerrado} · ${texto}`}
        className={className}
      />
    );
  }

  if (estado.mensaje) {
    return (
      <div className={cn("flex flex-col gap-[2px]", className)}>
        <EstadoLinea
          abierto={estado.abierto}
          texto={estado.abierto ? COPY.abierto : COPY.cerrado}
        />
        <span className="pl-[14px] text-meta leading-snug text-ink-soft/75">
          {estado.mensaje}
        </span>
      </div>
    );
  }

  const texto = textoEstado(estado);
  if (!texto) return null;

  return (
    <EstadoLinea abierto={estado.abierto} texto={texto} className={className} />
  );
}

function EstadoLinea({
  abierto,
  texto,
  className,
}: {
  abierto: boolean;
  texto: string;
  className?: string;
}) {
  return (
    <span
      suppressHydrationWarning
      className={cn(
        "inline-flex items-center gap-[7px] font-lv-display text-small font-semibold",
        abierto ? "text-verde-700" : "text-destructive",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-[7px] rounded-full",
          abierto
            ? "bg-verde-500 shadow-[0_0_0_3px_rgba(24,149,79,0.14)]"
            : "bg-destructive/70",
        )}
      />
      {texto}
    </span>
  );
}
