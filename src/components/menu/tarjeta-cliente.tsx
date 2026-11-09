"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Gift,
  RotateCcw,
  Stamp,
  Undo2,
  WifiOff,
} from "lucide-react";
import { textoFalta, type EstadoTarjeta } from "@/lib/fidelidad";
import type { MovimientoVistaDTO, TarjetaVistaDTO } from "@/lib/tarjeta-vista";
import { NoExiste } from "@/components/menu/tarjeta-no-existe";
import { cn } from "@/lib/utils";

const HORA = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Havana",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const DIA = new Intl.DateTimeFormat("es-CU", {
  timeZone: "America/Havana",
  day: "numeric",
  month: "short",
});

const DIA_LARGO = new Intl.DateTimeFormat("es-CU", {
  timeZone: "America/Havana",
  day: "numeric",
  month: "short",
  year: "numeric",
});

function hora12(fecha: Date): string {
  /* en-US da «3:40 PM»; en español sería «3:40 p. m.» y aquí se lee peor. */
  return HORA.format(fecha).toLowerCase();
}

function diaEnHavana(fecha: Date): string {
  /* YYYY-MM-DD en La Habana, para comparar días sin líos de zona horaria. */
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Havana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

/**
 * «hoy a las 3:40 pm», «ayer a las 11:05 am» o «el 5 nov 2026».
 *
 * El aviso de sin conexión tiene que decir de cuándo es lo que se está viendo:
 * es la diferencia entre «me falta un sello» y «me faltaba uno esta mañana».
 */
function cuando(fecha: Date, ahora: Date = new Date()): string {
  const dia = diaEnHavana(fecha);
  if (dia === diaEnHavana(ahora)) return `hoy a las ${hora12(fecha)}`;
  if (dia === diaEnHavana(new Date(ahora.getTime() - 24 * 60 * 60 * 1000))) {
    return `ayer a las ${hora12(fecha)}`;
  }
  return `el ${DIA_LARGO.format(fecha)}`;
}

const CLAVE_TARJETA = (placeId: string) => `la-verde:tarjeta:${placeId}`;

function olvidarToken(placeId: string) {
  try {
    window.localStorage.removeItem(CLAVE_TARJETA(placeId));
  } catch {
    /* Sin almacenamiento no hay nada que olvidar. */
  }
}

/** La copia pequeña que usa la píldora de la carta, con su fecha. */
function guardarResumen(vista: TarjetaVistaDTO, token: string) {
  const meta = vista.tarjeta.siguiente ?? vista.tarjeta.metaFinal;
  try {
    window.localStorage.setItem(
      CLAVE_TARJETA(vista.negocio.id),
      JSON.stringify({
        token,
        sellos: vista.tarjeta.sellos,
        meta: meta.sellos,
        premio: vista.tarjeta.listas[0]?.premio ?? null,
        fecha: vista.generadoEn,
      }),
    );
  } catch {
    /* Modo privado o cuota llena: la tarjeta se ve igual. */
  }
}

function esVista(value: unknown): value is TarjetaVistaDTO {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<TarjetaVistaDTO>;
  return (
    typeof v.generadoEn === "string" &&
    Boolean(v.negocio && typeof v.negocio.id === "string") &&
    Boolean(v.cliente && typeof v.cliente.telefono === "string") &&
    Boolean(v.tarjeta && typeof v.tarjeta.sellos === "number") &&
    Array.isArray(v.tarjeta?.metas) &&
    Array.isArray(v.movimientos)
  );
}

function descripcionMovimiento(
  movimiento: MovimientoVistaDTO,
  tarjeta: EstadoTarjeta,
): string {
  switch (movimiento.tipo) {
    case "sello":
      return movimiento.pedidoCodigo
        ? `Pedido #${movimiento.pedidoCodigo}`
        : "Sello en el local";
    case "canje": {
      const premio =
        movimiento.metaIndice !== null
          ? tarjeta.config.metas[movimiento.metaIndice]?.premio
          : null;
      return premio ? `Canjeaste ${premio}` : "Canje de premio";
    }
    case "reversion":
      return "Pedido cancelado";
    default:
      return movimiento.nota?.trim() || "Ajuste de sellos";
  }
}

function IconoMovimiento({ tipo }: { tipo: MovimientoVistaDTO["tipo"] }) {
  const Icon =
    tipo === "sello"
      ? Stamp
      : tipo === "canje"
        ? Gift
        : tipo === "reversion"
          ? RotateCcw
          : Undo2;
  return <Icon size={15} strokeWidth={1.8} aria-hidden="true" />;
}

/** La cuadrícula de sellos. La última meta decide cuántas casillas hay. */
function Cuadricula({ tarjeta }: { tarjeta: EstadoTarjeta }) {
  const total = tarjeta.metaFinal.sellos;
  const llenos = Math.min(tarjeta.sellos, total);
  const hitos = new Set(tarjeta.metas.map((m) => m.sellos));
  const sobrantes = Math.max(0, tarjeta.sellos - total);

  return (
    <div>
      <div
        className="grid grid-cols-5 gap-[10px]"
        role="img"
        aria-label={`${tarjeta.sellos} de ${total} sellos`}
      >
        {Array.from({ length: total }, (_, i) => {
          const numero = i + 1;
          const lleno = numero <= llenos;
          const esHito = hitos.has(numero);
          return (
            <div
              key={numero}
              className={cn(
                "relative grid aspect-square place-items-center rounded-2xl border transition-colors",
                lleno
                  ? "border-verde-500 bg-verde-400 text-verde-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                  : "border-dashed border-ink/15 bg-white/40 text-ink/20",
                esHito && !lleno && "border-verde-300/70",
              )}
            >
              <Stamp size={18} strokeWidth={lleno ? 2 : 1.6} aria-hidden="true" />
              {esHito && (
                <span className="absolute -right-[5px] -top-[5px] grid size-4 place-items-center rounded-full bg-sand-deep text-ink-soft/70 ring-1 ring-ink/5">
                  <Gift size={9} strokeWidth={2} aria-hidden="true" />
                </span>
              )}
            </div>
          );
        })}
      </div>
      {sobrantes > 0 && (
        <p className="mt-gap-xs text-meta text-ink-soft/70">
          Y {sobrantes} {sobrantes === 1 ? "sello de sobra" : "sellos de sobra"}{" "}
          para la próxima tarjeta.
        </p>
      )}
    </div>
  );
}

/**
 * La tarjeta que abre el cliente desde el enlace de WhatsApp.
 *
 * Se pinta en el servidor —así el service worker puede guardarla y enseñarla
 * sin red— y esta isla la refresca en segundo plano. Si la red falla, no se
 * toca nada: queda la copia y aparece una franja con la fecha de lo que se ve.
 * Si la tarjeta ya no existe, se olvida el token de este dispositivo.
 */
export function TarjetaCliente({
  token,
  inicial,
}: {
  token: string;
  inicial: TarjetaVistaDTO;
}) {
  const [vista, setVista] = useState(inicial);
  const [sinConexion, setSinConexion] = useState(false);
  const [borrada, setBorrada] = useState(false);

  useEffect(() => {
    const control = new AbortController();

    fetch(`/api/tarjeta/${encodeURIComponent(token)}`, {
      signal: control.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (res.status === 404 || res.status === 410) {
          olvidarToken(inicial.negocio.id);
          setBorrada(true);
          return;
        }
        if (!res.ok) {
          setSinConexion(true);
          return;
        }

        const datos: unknown = await res.json().catch(() => null);
        if (!esVista(datos)) {
          setSinConexion(true);
          return;
        }

        setVista(datos);
        setSinConexion(false);
        /* Con conexión y datos frescos: la píldora de la carta se queda con
           esta copia. Sin red no se escribe nada, para no fechar de hoy un
           saldo de ayer. */
        guardarResumen(datos, token);
      })
      .catch(() => {
        if (control.signal.aborted) return;
        setSinConexion(true);
      });

    return () => control.abort();
  }, [token, inicial.negocio.id]);

  if (borrada) return <NoExiste />;

  const { cliente, tarjeta, negocio, movimientos } = vista;
  const falta = textoFalta(tarjeta);
  const premioListo = tarjeta.listas[0]?.premio ?? null;
  const generado = new Date(vista.generadoEn);

  return (
    <main className="mx-auto w-full max-w-md px-gap-md pb-gap-xl pt-gap-md">
      {sinConexion && (
        <p className="mb-gap-sm flex items-center justify-center gap-[6px] rounded-xl border border-amber-200 bg-amber-50 px-gap-sm py-[7px] text-center text-meta font-medium text-amber-800">
          <WifiOff size={13} strokeWidth={2} aria-hidden="true" />
          Sin conexión · actualizada {cuando(generado)}
        </p>
      )}

      {/* Cabecera del negocio */}
      <header className="flex items-center gap-gap-sm">
        <span className="relative size-11 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-ink/5">
          {negocio.logoUrl ? (
            <Image
              src={negocio.logoUrl}
              alt={negocio.nombre}
              fill
              sizes="44px"
              className="object-cover"
            />
          ) : (
            <span className="grid size-full place-items-center font-lv-display text-small font-bold text-verde-700">
              {negocio.nombre.charAt(0)}
            </span>
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate font-lv-display text-small font-semibold text-ink">
            {negocio.nombre}
          </p>
          <p className="text-meta text-ink-soft/60">{tarjeta.config.nombre}</p>
        </div>
      </header>

      {/* La tarjeta */}
      <section className="mt-gap-md overflow-hidden rounded-3xl border border-verde-700/15 bg-gradient-to-br from-verde-500 via-verde-600 to-verde-800 p-gap-md text-verde-50 shadow-card">
        <div className="flex items-start justify-between gap-gap-sm">
          <div>
            <p className="font-lv-display text-[11px] font-semibold uppercase tracking-[0.18em] text-verde-100/80">
              {tarjeta.config.nombre}
            </p>
            <p className="mt-[6px] font-lv-display text-h2 font-bold leading-none tabular-nums text-white">
              {tarjeta.sellos}
              <span className="ml-[6px] text-small font-medium text-verde-100/80">
                de {tarjeta.metaFinal.sellos} sellos
              </span>
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-[10px] py-[4px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-verde-50/90 ring-1 ring-white/15">
            Ciclo {tarjeta.ciclo}
          </span>
        </div>

        <div className="mt-gap-md rounded-2xl bg-verde-950/15 p-gap-sm ring-1 ring-white/10">
          <Cuadricula tarjeta={tarjeta} />
        </div>

        <p className="mt-gap-sm font-mono text-meta text-verde-100/85">
          {cliente.nombre ? `${cliente.nombre} · ` : ""}
          {cliente.telefono}
        </p>
      </section>

      {/* Premio listo o cuánto falta */}
      {premioListo ? (
        <div className="mt-gap-md flex items-start gap-gap-sm rounded-2xl border border-verde-300 bg-verde-50 p-gap-sm">
          <span className="mt-[1px] grid size-8 shrink-0 place-items-center rounded-xl bg-verde-400 text-verde-950">
            <BadgeCheck size={17} strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <p className="font-lv-display text-small font-semibold text-verde-800">
              ¡Ya tienes tu premio!
            </p>
            <p className="text-meta text-verde-700/85">
              {premioListo}. Pídelo en tu próximo pedido.
            </p>
          </div>
        </div>
      ) : (
        falta && (
          <p className="mt-gap-md rounded-2xl border border-ink/5 bg-white p-gap-sm text-small text-ink-soft shadow-soft">
            {falta}
          </p>
        )
      )}

      {/* Metas */}
      <section className="mt-gap-md">
        <h2 className="font-lv-display text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft/50">
          Los premios
        </h2>
        <ul className="mt-gap-sm space-y-[6px]">
          {tarjeta.metas.map((meta, indice) => (
            <li
              key={indice}
              className={cn(
                "flex items-center gap-gap-sm rounded-2xl border bg-white p-gap-sm",
                meta.alcanzada && !meta.canjeada
                  ? "border-verde-300"
                  : "border-ink/5",
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-xl",
                  meta.alcanzada && !meta.canjeada
                    ? "bg-verde-400 text-verde-950"
                    : "bg-sand-deep text-ink-soft/50",
                )}
              >
                <Gift size={15} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-semibold text-ink">
                  {meta.premio}
                </p>
                <p className="text-meta text-ink-soft/60">
                  {meta.sellos} {meta.sellos === 1 ? "sello" : "sellos"}
                  {meta.canjeada
                    ? " · ya canjeado este ciclo"
                    : meta.alcanzada
                      ? " · listo para canjear"
                      : ` · te faltan ${meta.faltan}`}
                </p>
                <div className="mt-[6px] h-[5px] overflow-hidden rounded-full bg-ink/8">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      meta.canjeada
                        ? "bg-ink/20"
                        : meta.alcanzada
                          ? "bg-verde-400"
                          : "bg-verde-300",
                    )}
                    style={{
                      width: `${Math.min(100, Math.round((tarjeta.sellos / meta.sellos) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Movimientos */}
      {movimientos.length > 0 && (
        <section className="mt-gap-md">
          <h2 className="font-lv-display text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft/50">
            Últimos movimientos
          </h2>
          <ul className="mt-gap-sm divide-y divide-ink/5 overflow-hidden rounded-2xl border border-ink/5 bg-white">
            {movimientos.map((movimiento) => (
              <li
                key={movimiento.id}
                className="flex items-center gap-gap-sm px-gap-sm py-[9px]"
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-lg",
                    movimiento.tipo === "sello"
                      ? "bg-verde-50 text-verde-600"
                      : movimiento.tipo === "canje"
                        ? "bg-sand-deep text-ink-soft/70"
                        : "bg-ink/5 text-ink-soft/50",
                  )}
                >
                  <IconoMovimiento tipo={movimiento.tipo} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-meta font-medium text-ink">
                    {descripcionMovimiento(movimiento, tarjeta)}
                  </p>
                  <p className="text-[11px] text-ink-soft/55">
                    {DIA.format(new Date(movimiento.creadoEn))}
                    {movimiento.anulado ? " · anulado" : ""}
                  </p>
                </div>
                {movimiento.cantidad !== 0 && (
                  <span
                    className={cn(
                      "shrink-0 font-lv-display text-meta font-semibold tabular-nums",
                      movimiento.cantidad > 0
                        ? "text-verde-700"
                        : "text-ink-soft/50",
                    )}
                  >
                    {movimiento.cantidad > 0 ? "+" : ""}
                    {movimiento.cantidad}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        href={`/m/${negocio.slug}`}
        className="mt-gap-lg inline-flex h-12 w-full items-center justify-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-colors duration-300 ease-outquint hover:bg-verde-300"
      >
        Pedir ahora
        <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
      </Link>

      <p className="mt-gap-md text-center text-[11px] leading-relaxed text-ink-soft/45">
        Actualizada el {DIA_LARGO.format(generado)} a las {hora12(generado)}. Tu
        tarjeta vive en este enlace: guárdalo para volver a verla cuando quieras.
      </p>
    </main>
  );
}
