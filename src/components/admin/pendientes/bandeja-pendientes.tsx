"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  LifeBuoy,
  Loader2,
  MessageCircle,
  Send,
  Store,
} from "lucide-react";
import { clsx } from "clsx";
import type { PendienteAdmin, TipoPendiente } from "@/lib/admin-pendientes";
import {
  BOTON_ADMIN_BASE,
  BOTON_ADMIN_VARIANTE,
  TAMANO_BOTON_ADMIN,
} from "@/components/admin/ui/clases";
import { ChapitaEstado } from "@/components/admin/ui/chapita";
import { EstadoVacioAdmin, TarjetaAdmin } from "@/components/admin/ui/tarjeta";

/**
 * La bandeja de Pendientes.
 *
 * Los datos llegan del servidor ya ordenados y recortados. Aquí solo queda
 * resolver: aprobar una solicitud o confirmar un pago se hace con una petición
 * y la fila desaparece sin recargar; responder, revisar u ofrecer un plan abren
 * su sección; recordar un cobro abre WhatsApp con el mensaje escrito.
 *
 * Cada acción que escribe pasa por una ruta que ya comprueba el rol de admin en
 * el servidor y registra su entrada de actividad.
 */
const ICONO: Record<TipoPendiente, typeof LifeBuoy> = {
  soporte: LifeBuoy,
  solicitud: ClipboardList,
  pago: CreditCard,
  cobro: MessageCircle,
  prueba: Clock,
  publicacion: Send,
  ficha: Store,
  diagnostico: Activity,
};

const TONO: Record<
  TipoPendiente,
  "ok" | "aviso" | "error" | "info" | "neutra"
> = {
  soporte: "info",
  solicitud: "aviso",
  pago: "ok",
  cobro: "error",
  prueba: "aviso",
  publicacion: "info",
  ficha: "neutra",
  diagnostico: "error",
};

export function BandejaPendientes({
  pendientes,
  total,
}: {
  pendientes: PendienteAdmin[];
  total: number;
}) {
  const [resueltos, setResueltos] = useState<Set<string>>(new Set());
  const [ocupada, setOcupada] = useState<string | null>(null);
  const router = useRouter();

  const visibles = useMemo(
    () => pendientes.filter((p) => !resueltos.has(p.clave)),
    [pendientes, resueltos],
  );

  /* Solo se descuentan las claves que siguen en la lista del servidor. Tras
     `router.refresh()`, la clave resuelta ya no llega y restarla otra vez
     dejaría el contador por debajo de lo que se ve. */
  const resueltosEnLista = useMemo(
    () => pendientes.reduce((n, p) => n + (resueltos.has(p.clave) ? 1 : 0), 0),
    [pendientes, resueltos],
  );
  const restantes = Math.max(0, total - resueltosEnLista);

  /* Al llegar la bandeja nueva, las claves resueltas que ya no están se
     olvidan. Si no, un pago o un cobro nuevo del mismo negocio reutilizaría la
     clave y quedaría oculto por una resolución de hace un rato. */
  useEffect(() => {
    setResueltos((prev) => {
      if (prev.size === 0) return prev;
      const enLista = new Set(pendientes.map((p) => p.clave));
      const siguiente = new Set([...prev].filter((clave) => enLista.has(clave)));
      return siguiente.size === prev.size ? prev : siguiente;
    });
  }, [pendientes]);

  function resolverEnPantalla(clave: string) {
    setResueltos((prev) => new Set(prev).add(clave));
  }

  async function ejecutar(pendiente: PendienteAdmin) {
    const { accion } = pendiente;

    if (accion.tipo === "abrir") {
      router.push(accion.href);
      return;
    }

    if (accion.tipo === "whatsapp") {
      window.open(accion.href, "_blank", "noopener,noreferrer");
      /* La deuda sigue ahí, pero en esta sesión la fila ya se atendió: al
         recargar vuelve si el negocio no pagó. */
      resolverEnPantalla(pendiente.clave);
      return;
    }

    setOcupada(pendiente.clave);
    try {
      const respuesta =
        accion.tipo === "aprobar_solicitud"
          ? await fetch(`/api/places/${accion.negocioId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reviewStatus: "approved",
                isActive: true,
              }),
            })
          : await fetch(`/api/admin/pagos/${accion.pagoId}/confirmar`, {
              method: "POST",
            });

      const datos = (await respuesta.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!respuesta.ok) {
        toast.error(datos?.error ?? "No se pudo resolver el pendiente.");
        return;
      }

      resolverEnPantalla(pendiente.clave);
      /* La acción puede cambiar más que esta fila: confirmar un pago invalida
         sus duplicados y aprobar una solicitud la saca de otras colas. Se pide
         al servidor la bandeja nueva; el estado local solo tapa la fila mientras
         llega. */
      router.refresh();
      toast.success(
        accion.tipo === "aprobar_solicitud"
          ? `«${pendiente.titulo}» ya está publicado.`
          : `Pago de «${pendiente.titulo}» confirmado.`,
      );
    } catch {
      toast.error("No hubo respuesta del servidor. No se cambió nada.");
    } finally {
      setOcupada(null);
    }
  }

  return (
    <TarjetaAdmin className="p-0">
      <div className="flex items-center justify-between gap-gap-sm border-b border-ink/5 px-gap-md py-gap-sm">
        <div className="min-w-0">
          <h2 className="font-lv-display text-body font-semibold text-ink">
            Necesita a uno de los dos
          </h2>
          <p className="text-meta text-ink-soft/75">
            {restantes === 0
              ? "Nada esperando respuesta."
              : `${restantes} ${restantes === 1 ? "cosa" : "cosas"} esperando. Lo más viejo, arriba.`}
          </p>
        </div>
        <ChapitaEstado tono={restantes === 0 ? "ok" : "aviso"} punto={false}>
          {restantes}
        </ChapitaEstado>
      </div>

      {visibles.length === 0 ? (
        <EstadoVacioAdmin
          icono={CheckCircle2}
          titulo="Todo al día"
          descripcion="No hay conversaciones, cobros ni solicitudes esperando a una persona."
        />
      ) : (
        <div className="px-gap-md">
          {visibles.map((pendiente) => {
            const accion = pendiente.accion;
            const Icono = ICONO[pendiente.tipo];
            const Ocupado = ocupada === pendiente.clave;

            return (
              <div
                key={pendiente.clave}
                className="flex flex-col gap-gap-sm border-b border-ink/5 py-gap-md last:border-b-0 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-gap-sm">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-verde-50 text-verde-700">
                    <Icono size={18} strokeWidth={1.8} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-gap-xs">
                      <ChapitaEstado tono={TONO[pendiente.tipo]} punto={false}>
                        {pendiente.etiquetaTipo}
                      </ChapitaEstado>
                    </div>
                    <p className="mt-[3px] font-lv-display text-small font-semibold text-ink text-pretty">
                      {pendiente.titulo}
                    </p>
                    <p className="text-meta text-ink-soft/75 text-pretty">
                      {pendiente.detalle}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-gap-xs max-sm:pl-[52px] sm:shrink-0 sm:justify-end">
                  {accion.tipo === "aprobar_solicitud" ||
                  accion.tipo === "confirmar_pago" ? (
                    <button
                      type="button"
                      onClick={() => void ejecutar(pendiente)}
                      disabled={Ocupado}
                      className={clsx(
                        BOTON_ADMIN_BASE,
                        BOTON_ADMIN_VARIANTE.primario,
                        TAMANO_BOTON_ADMIN.pequeno,
                      )}
                    >
                      {Ocupado ? (
                        <Loader2
                          size={15}
                          strokeWidth={1.8}
                          className="animate-spin"
                          aria-hidden
                        />
                      ) : null}
                      {accion.tipo === "aprobar_solicitud"
                        ? "Aprobar"
                        : "Confirmar pago"}
                    </button>
                  ) : accion.tipo === "whatsapp" ? (
                    <a
                      href={accion.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => resolverEnPantalla(pendiente.clave)}
                      className={clsx(
                        BOTON_ADMIN_BASE,
                        BOTON_ADMIN_VARIANTE.primario,
                        TAMANO_BOTON_ADMIN.pequeno,
                      )}
                    >
                      {accion.etiqueta}
                    </a>
                  ) : (
                    <Link
                      href={accion.href}
                      className={clsx(
                        BOTON_ADMIN_BASE,
                        BOTON_ADMIN_VARIANTE.primario,
                        TAMANO_BOTON_ADMIN.pequeno,
                      )}
                    >
                      {accion.etiqueta}
                    </Link>
                  )}

                  {pendiente.accionSecundaria && (
                    <Link
                      href={pendiente.accionSecundaria.href}
                      className="inline-flex min-h-11 items-center px-gap-xs font-lv-display text-meta font-semibold text-ink-soft/75 transition-colors duration-300 hover:text-verde-700"
                    >
                      {pendiente.accionSecundaria.etiqueta}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </TarjetaAdmin>
  );
}
