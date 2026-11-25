"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  BadgeCheck,
  Clock,
  CreditCard,
  ExternalLink,
  Eye,
  Flame,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Send,
  ShoppingBag,
  Sparkles,
  StickyNote,
  Users,
  Zap,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";
import type { Ficha360Admin } from "@/lib/admin-ficha";
import type { Plan } from "@/lib/plans";
import { HojaAdmin } from "./ui/hoja";
import { BarraProgreso } from "./ui/progreso";
import { BotonAdmin } from "./ui/botones";
import { ChapitaEstado } from "./ui/chapita";
import { TarjetaAdmin } from "./ui/tarjeta";
import {
  BOTON_ADMIN_BASE,
  BOTON_ADMIN_VARIANTE,
  TAMANO_BOTON_ADMIN,
} from "./ui/clases";

/**
 * La ficha 360 de un negocio, montada una sola vez en el armazón.
 *
 * Se abre cuando la URL lleva `?negocio=<id>`, venga el enlace de Negocios,
 * Solicitudes, Publicaciones o del buscador. Al cerrar se quita el parámetro,
 * así que el botón atrás del navegador también la cierra.
 *
 * Todo lo que se ve viene del servidor (`/api/admin/negocios/[id]/ficha`).
 * Cambiar plan y destacar usan las rutas que ya existían; la nota se guarda al
 * salir del campo. Cada acción deja su entrada en Actividad.
 */

const TONO_PUBLICACION = {
  publicado: "ok",
  pendiente: "aviso",
  rechazado: "error",
  oculto: "neutra",
  cerrado: "error",
  temporal: "aviso",
} as const;

const ETIQUETA_PUBLICACION = {
  publicado: "Publicado",
  pendiente: "Pendiente",
  rechazado: "Rechazado",
  oculto: "Oculto",
  cerrado: "Cerrado",
  temporal: "Cerrado temporalmente",
} as const;

const TONO_PAGO = {
  al_dia: "ok",
  prueba: "aviso",
  vencida: "error",
  pendiente: "aviso",
  gratis: "neutra",
  cancelada: "error",
} as const;

function numero(valor: number): string {
  return new Intl.NumberFormat("es-CU", {
    maximumFractionDigits: 2,
  }).format(valor);
}

function iniciales(nombre: string): string {
  return (
    nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? "")
      .join("") || "·"
  );
}

export function Ficha360() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const negocioId = searchParams.get("negocio");

  const [ficha, setFicha] = useState<Ficha360Admin | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [nota, setNota] = useState("");
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [notaGuardada, setNotaGuardada] = useState(false);
  const [cambiandoPlan, setCambiandoPlan] = useState(false);
  const [cambiandoDestaque, setCambiandoDestaque] = useState(false);

  useEffect(() => {
    if (!negocioId) {
      setFicha(null);
      setError(null);
      setCargando(false);
      return;
    }

    const control = new AbortController();
    setCargando(true);
    setError(null);

    fetch(`/api/admin/negocios/${encodeURIComponent(negocioId)}/ficha`, {
      signal: control.signal,
    })
      .then(async (respuesta) => {
        const datos = (await respuesta.json().catch(() => null)) as
          (Ficha360Admin & { error?: string }) | null;
        if (!respuesta.ok || !datos) {
          throw new Error(datos?.error ?? "No se pudo cargar la ficha.");
        }
        return datos;
      })
      .then((datos) => {
        if (control.signal.aborted) return;
        setFicha(datos);
        setNota(datos.nota);
        setNotaGuardada(false);
      })
      .catch((fallo) => {
        if (control.signal.aborted) return;
        setFicha(null);
        setError(
          fallo instanceof Error
            ? fallo.message
            : "No se pudo cargar la ficha.",
        );
      })
      .finally(() => {
        if (!control.signal.aborted) setCargando(false);
      });

    return () => control.abort();
  }, [negocioId, version]);

  function cerrar() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("negocio");
    const consulta = params.toString();
    router.replace(consulta ? `${pathname}?${consulta}` : pathname, {
      scroll: false,
    });
  }

  function recargar() {
    setVersion((actual) => actual + 1);
  }

  async function guardarNota() {
    if (!ficha || nota === ficha.nota || guardandoNota) return;

    setGuardandoNota(true);
    try {
      const respuesta = await fetch(`/api/admin/negocios/${ficha.id}/ficha`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nota }),
      });
      const datos = (await respuesta.json().catch(() => null)) as {
        nota?: string;
        error?: string;
      } | null;
      if (!respuesta.ok) {
        throw new Error(datos?.error ?? "No se pudo guardar la nota.");
      }
      const guardada = datos?.nota ?? nota;
      setFicha((actual) => (actual ? { ...actual, nota: guardada } : actual));
      setNota(guardada);
      setNotaGuardada(true);
      toast.success("Nota interna guardada.");
    } catch (fallo) {
      toast.error(
        fallo instanceof Error ? fallo.message : "No se pudo guardar la nota.",
      );
    } finally {
      setGuardandoNota(false);
    }
  }

  async function cambiarPlan(plan: Plan) {
    if (!ficha || plan === ficha.plan.contratado || cambiandoPlan) return;

    setCambiandoPlan(true);
    try {
      const respuesta = await fetch("/api/admin/suscripciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negocioId: ficha.id, plan }),
      });
      const datos = (await respuesta.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!respuesta.ok) {
        throw new Error(datos?.error ?? "No se pudo cambiar el plan.");
      }
      const nombre = ficha.planes.find((opcion) => opcion.id === plan)?.nombre;
      toast.success(`Plan cambiado a ${nombre ?? plan}.`);
      recargar();
    } catch (fallo) {
      toast.error(
        fallo instanceof Error ? fallo.message : "No se pudo cambiar el plan.",
      );
    } finally {
      setCambiandoPlan(false);
    }
  }

  async function alternarDestaque() {
    if (!ficha || cambiandoDestaque) return;

    setCambiandoDestaque(true);
    try {
      const respuesta = await fetch(`/api/places/${ficha.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBoosted: !ficha.isBoosted }),
      });
      const datos = (await respuesta.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!respuesta.ok) {
        throw new Error(datos?.error ?? "No se pudo cambiar el destacado.");
      }
      toast.success(
        ficha.isBoosted
          ? `«${ficha.name}» ya no está destacado.`
          : `«${ficha.name}» está destacado.`,
      );
      recargar();
    } catch (fallo) {
      toast.error(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo cambiar el destacado.",
      );
    } finally {
      setCambiandoDestaque(false);
    }
  }

  return (
    <HojaAdmin
      open={Boolean(negocioId)}
      onOpenChange={(abierta) => {
        if (!abierta) cerrar();
      }}
      titulo={ficha?.name ?? "Ficha del negocio"}
      descripcion={
        ficha ? `${ficha.city}, ${ficha.province}` : "Cargando negocio…"
      }
    >
      {error ? (
        <div className="flex flex-col items-start gap-gap-sm">
          <p
            role="alert"
            className="w-full rounded-xl border border-destructive/20 bg-destructive/5 px-gap-sm py-gap-sm text-small text-destructive-ink"
          >
            {error}
          </p>
          <BotonAdmin onClick={recargar} tamano="pequeno">
            Reintentar
          </BotonAdmin>
        </div>
      ) : !ficha ? (
        <div className="grid place-items-center gap-gap-sm py-gap-xl text-center">
          <Loader2
            size={24}
            strokeWidth={1.8}
            className="animate-spin text-verde-600"
          />
          <p className="text-small text-ink-soft/70">Cargando la ficha…</p>
        </div>
      ) : (
        <FichaContenido
          ficha={ficha}
          nota={nota}
          onNotaChange={(valor) => {
            setNota(valor);
            setNotaGuardada(false);
          }}
          onNotaBlur={() => void guardarNota()}
          guardandoNota={guardandoNota}
          notaGuardada={notaGuardada}
          cambiandoPlan={cambiandoPlan}
          cambiandoDestaque={cambiandoDestaque}
          onCambiarPlan={(plan) => void cambiarPlan(plan)}
          onAlternarDestaque={() => void alternarDestaque()}
          recargando={cargando}
        />
      )}
    </HojaAdmin>
  );
}

function FichaContenido({
  ficha,
  nota,
  onNotaChange,
  onNotaBlur,
  guardandoNota,
  notaGuardada,
  cambiandoPlan,
  cambiandoDestaque,
  onCambiarPlan,
  onAlternarDestaque,
  recargando,
}: {
  ficha: Ficha360Admin;
  nota: string;
  onNotaChange: (valor: string) => void;
  onNotaBlur: () => void;
  guardandoNota: boolean;
  notaGuardada: boolean;
  cambiandoPlan: boolean;
  cambiandoDestaque: boolean;
  onCambiarPlan: (plan: Plan) => void;
  onAlternarDestaque: () => void;
  recargando: boolean;
}) {
  return (
    <div className="flex flex-col gap-gap-md">
      <div className="flex items-start gap-gap-sm">
        {ficha.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ficha.logoUrl}
            alt={`Logo de ${ficha.name}`}
            className="size-14 shrink-0 rounded-2xl border border-ink/5 object-cover"
            loading="lazy"
          />
        ) : (
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-verde-50 font-lv-display text-body font-bold text-verde-700">
            {iniciales(ficha.name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-lv-display text-small font-semibold text-ink">
            {ficha.tipoLabel}
            {ficha.categoria ? ` · ${ficha.categoria}` : ""}
          </p>
          <div className="mt-gap-xs flex flex-wrap gap-gap-xs">
            <ChapitaEstado
              tono={
                ficha.plan.estado === "cancelada"
                  ? "error"
                  : ficha.plan.efectivo !== ficha.plan.contratado
                    ? "aviso"
                    : ficha.plan.efectivo === "gratis"
                      ? "neutra"
                      : "ok"
              }
              punto={false}
            >
              {ficha.plan.efectivo !== ficha.plan.contratado
                ? `Prueba · ${ficha.plan.nombre}`
                : ficha.plan.nombre}
            </ChapitaEstado>
            <ChapitaEstado
              tono={TONO_PUBLICACION[ficha.estadoPublicacion]}
              punto={false}
            >
              {ETIQUETA_PUBLICACION[ficha.estadoPublicacion]}
            </ChapitaEstado>
            {ficha.isBoosted && (
              <ChapitaEstado tono="info" punto={false}>
                <Zap size={11} strokeWidth={2} aria-hidden />
                Destacado
              </ChapitaEstado>
            )}
            {ficha.verificado && (
              <ChapitaEstado tono="ok" punto={false}>
                <BadgeCheck size={11} strokeWidth={2} aria-hidden />
                Verificado
              </ChapitaEstado>
            )}
          </div>
        </div>
        {recargando && (
          <Loader2
            size={16}
            strokeWidth={1.8}
            className="mt-1 shrink-0 animate-spin text-verde-600"
            aria-label="Actualizando"
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-gap-xs">
        {ficha.dueno?.whatsappHref ? (
          <a
            href={ficha.dueno.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className={clsx(
              BOTON_ADMIN_BASE,
              BOTON_ADMIN_VARIANTE.secundario,
              TAMANO_BOTON_ADMIN.pequeno,
              "w-full",
            )}
          >
            <MessageCircle size={15} strokeWidth={1.8} aria-hidden />
            WhatsApp
          </a>
        ) : (
          <BotonAdmin
            tamano="pequeno"
            disabled
            title="El negocio no tiene un teléfono válido"
            className="w-full"
          >
            <MessageCircle size={15} strokeWidth={1.8} aria-hidden />
            Sin teléfono
          </BotonAdmin>
        )}
        <a
          href={`/place/${ficha.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className={clsx(
            BOTON_ADMIN_BASE,
            BOTON_ADMIN_VARIANTE.secundario,
            TAMANO_BOTON_ADMIN.pequeno,
            "w-full",
          )}
        >
          <ExternalLink size={15} strokeWidth={1.8} aria-hidden />
          Ver ficha
        </a>
        <Link
          href={`/admin/negocios/${ficha.id}/editar`}
          className={clsx(
            BOTON_ADMIN_BASE,
            BOTON_ADMIN_VARIANTE.secundario,
            TAMANO_BOTON_ADMIN.pequeno,
            "w-full",
          )}
        >
          <Pencil size={15} strokeWidth={1.8} aria-hidden />
          Editar
        </Link>
        <BotonAdmin
          tamano="pequeno"
          onClick={onAlternarDestaque}
          disabled={cambiandoDestaque}
          className="w-full"
        >
          <Flame size={15} strokeWidth={1.8} aria-hidden />
          {cambiandoDestaque
            ? "Guardando…"
            : ficha.isBoosted
              ? "Quitar destacado"
              : "Destacar"}
        </BotonAdmin>
      </div>

      <TarjetaAdmin className="flex flex-col gap-gap-sm">
        <div className="flex items-center justify-between gap-gap-sm">
          <p className="inline-flex items-center gap-gap-xs font-lv-display text-small font-semibold text-ink">
            <CreditCard size={16} strokeWidth={1.8} aria-hidden />
            Pago
          </p>
          <ChapitaEstado tono={TONO_PAGO[ficha.pago.estado]} punto={false}>
            {ficha.pago.etiqueta}
          </ChapitaEstado>
        </div>
        <p className="text-small text-ink-soft/80">{ficha.pago.detalle}</p>
        <div className="grid grid-cols-2 gap-gap-xs">
          <div className="rounded-xl bg-sand px-gap-sm py-gap-xs">
            <p className="text-meta text-ink-soft/60">USD / mes</p>
            <p className="font-lv-display text-body font-bold text-ink">
              {numero(ficha.plan.precioUsd)} USD
            </p>
          </div>
          <div className="rounded-xl bg-sand px-gap-sm py-gap-xs">
            <p className="text-meta text-ink-soft/60">CUP / mes</p>
            <p className="font-lv-display text-body font-bold text-ink">
              {numero(ficha.plan.precioCup)} CUP
            </p>
          </div>
        </div>
        <label className="flex flex-col gap-[4px] text-meta font-semibold text-ink-soft/70">
          Plan contratado
          <select
            value={ficha.plan.contratado}
            onChange={(event) => onCambiarPlan(event.target.value as Plan)}
            disabled={cambiandoPlan}
            className="h-10 rounded-xl border border-ink/10 bg-white px-gap-sm font-lv-display text-small font-semibold text-ink outline-none focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20 disabled:opacity-60"
          >
            {ficha.planes.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>
                {opcion.nombre}
              </option>
            ))}
          </select>
        </label>
        {ficha.plan.efectivo !== ficha.plan.contratado && (
          <p className="text-meta text-ink-soft/60">
            Ahora mismo manda {ficha.plan.nombre}
            {ficha.plan.trialHasta
              ? ` por la prueba que termina el ${ficha.plan.trialHasta}`
              : ""}
            .
          </p>
        )}
        {ficha.plan.venceEn && (
          <p className="text-meta text-ink-soft/60">
            Vencimiento: {ficha.plan.venceEn}
          </p>
        )}
      </TarjetaAdmin>

      <TarjetaAdmin className="flex flex-col gap-gap-sm">
        <div className="flex items-center justify-between gap-gap-sm">
          <p className="inline-flex items-center gap-gap-xs font-lv-display text-small font-semibold text-ink">
            <Sparkles size={16} strokeWidth={1.8} aria-hidden />
            Ficha
          </p>
          <span className="font-lv-display text-small font-bold text-verde-700">
            {ficha.completitud.pct}%
          </span>
        </div>
        <BarraProgreso
          pct={ficha.completitud.pct}
          etiqueta="Completitud de la ficha"
        />
        {ficha.completitud.faltan.length === 0 ? (
          <p className="text-meta text-verde-700">La ficha está completa.</p>
        ) : (
          <ul className="flex flex-col gap-[3px] text-meta text-ink-soft/75">
            {ficha.completitud.faltan.map((falta) => (
              <li key={falta} className="flex items-start gap-[5px]">
                <span className="mt-[6px] size-[4px] shrink-0 rounded-full bg-lv-amber" />
                {falta}
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/admin/negocios/${ficha.id}/editar`}
          className="inline-flex min-h-11 items-center gap-gap-xs font-lv-display text-meta font-semibold text-verde-700 hover:text-verde-800"
        >
          Completar en el editor
          <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden />
        </Link>
      </TarjetaAdmin>

      <div className="grid grid-cols-3 gap-gap-xs">
        <Metrica
          icono={Eye}
          valor={ficha.metricas.visitas30}
          etiqueta="Visitas · 30 días"
        />
        <Metrica
          icono={ShoppingBag}
          valor={ficha.metricas.pedidos30}
          etiqueta="Pedidos · 30 días"
        />
        <Metrica
          icono={Send}
          valor={
            ficha.metricas.publicacionesTope === null
              ? `${ficha.metricas.publicacionesUsadas}`
              : `${ficha.metricas.publicacionesUsadas}/${ficha.metricas.publicacionesTope}`
          }
          etiqueta="Publicaciones"
        />
      </div>

      <TarjetaAdmin className="flex flex-col gap-gap-sm">
        <p className="inline-flex items-center gap-gap-xs font-lv-display text-small font-semibold text-ink">
          <Users size={16} strokeWidth={1.8} aria-hidden />
          Dueño
        </p>
        {ficha.dueno ? (
          <div className="flex flex-col gap-[4px] text-small text-ink-soft/80">
            <p className="font-lv-display font-semibold text-ink">
              {ficha.dueno.nombre}
            </p>
            <a
              href={`mailto:${ficha.dueno.email}`}
              className="inline-flex items-center gap-gap-xs hover:text-verde-700"
            >
              <Mail size={14} strokeWidth={1.8} aria-hidden />
              {ficha.dueno.email}
            </a>
            {ficha.dueno.telefono && (
              <a
                href={`tel:${ficha.dueno.telefono}`}
                className="inline-flex items-center gap-gap-xs hover:text-verde-700"
              >
                <Phone size={14} strokeWidth={1.8} aria-hidden />
                {ficha.dueno.telefono}
              </a>
            )}
          </div>
        ) : (
          <p className="text-meta text-ink-soft/70">
            Sin dueño vinculado a este negocio.
          </p>
        )}
        <dl className="grid grid-cols-2 gap-gap-xs border-t border-ink/5 pt-gap-sm text-meta">
          <div>
            <dt className="text-ink-soft/55">Última actividad</dt>
            <dd className="font-semibold text-ink">
              {ficha.ultimaActividad ?? "Sin registro"}
            </dd>
          </div>
          <div>
            <dt className="text-ink-soft/55">Alta</dt>
            <dd className="font-semibold text-ink">{ficha.alta}</dd>
          </div>
          <div>
            <dt className="text-ink-soft/55">Afiliado</dt>
            <dd className="font-semibold text-ink">{ficha.afiliado ?? "No"}</dd>
          </div>
          <div>
            <dt className="text-ink-soft/55">Soporte</dt>
            <dd className="font-semibold text-ink">
              {ficha.soporte.abiertas === 0
                ? "Sin conversaciones"
                : `${ficha.soporte.abiertas} abierta${ficha.soporte.abiertas === 1 ? "" : "s"}`}
            </dd>
          </div>
        </dl>
        {ficha.soporte.ultimaId && (
          <Link
            href={`/admin/soporte?ticket=${encodeURIComponent(ficha.soporte.ultimaId)}`}
            className="inline-flex min-h-11 items-center gap-gap-xs font-lv-display text-meta font-semibold text-verde-700 hover:text-verde-800"
          >
            Abrir la última conversación
            <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden />
          </Link>
        )}
      </TarjetaAdmin>

      <TarjetaAdmin className="flex flex-col gap-gap-sm">
        <label
          htmlFor="ficha-nota-interna"
          className="inline-flex items-center gap-gap-xs font-lv-display text-small font-semibold text-ink"
        >
          <StickyNote size={16} strokeWidth={1.8} aria-hidden />
          Nota interna
        </label>
        <textarea
          id="ficha-nota-interna"
          value={nota}
          onChange={(event) => onNotaChange(event.target.value)}
          onBlur={onNotaBlur}
          rows={4}
          maxLength={4000}
          placeholder="Lo que hay que recordar de este negocio. Solo lo ve administración."
          className="min-h-[96px] w-full resize-y rounded-xl border border-ink/10 bg-white px-gap-sm py-gap-sm text-small text-ink outline-none transition-colors focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20"
        />
        <div className="flex items-center justify-between gap-gap-sm text-meta text-ink-soft/55">
          <span>Se guarda al salir del campo. Solo para administradores.</span>
          <span
            role="status"
            className="inline-flex items-center gap-[4px] font-semibold text-verde-700"
          >
            {guardandoNota ? (
              <>
                <Loader2 size={12} className="animate-spin" aria-hidden />
                Guardando…
              </>
            ) : notaGuardada ? (
              <>Guardado</>
            ) : null}
          </span>
        </div>
      </TarjetaAdmin>
    </div>
  );
}

function Metrica({
  icono: Icono,
  valor,
  etiqueta,
}: {
  icono: typeof Clock;
  valor: string | number;
  etiqueta: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/5 bg-white p-gap-sm">
      <Icono size={15} strokeWidth={1.8} className="text-verde-600" />
      <p className="mt-gap-xs font-lv-display text-body font-bold text-ink">
        {valor}
      </p>
      <p className="text-[10px] leading-tight text-ink-soft/60">{etiqueta}</p>
    </div>
  );
}
