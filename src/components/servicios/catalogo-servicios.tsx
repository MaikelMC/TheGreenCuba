"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { whatsappHref } from "@/lib/contact-links";
import { SUPPORT_WHATSAPP } from "@/lib/legal";
import {
  PACKS_ESTANDAR,
  CATEGORIAS,
  type CategoriaServicios,
  type ServicioCatalogo,
} from "@/content/servicios-categorias";
import {
  textoCup,
  type Catalogo,
  type ClaveModulo,
  type Pack,
} from "@/lib/plans";

/** «3,5» en vez de «3.5», igual que en las tarjetas de plan. */
function precioUsd(usd: number) {
  return usd % 1 === 0 ? String(usd) : usd.toFixed(1).replace(".", ",");
}

interface Props {
  catalogo: Catalogo;
  autenticado: boolean;
  /** Tiene algún negocio dado de alta: puede ir directo al pago. */
  tieneNegocio: boolean;
}

/**
 * El catálogo completo, con filtro por categoría.
 *
 * Cada servicio y cada pack acaba en el mismo sitio: la sección de planes del
 * panel, que es donde está el botón de QvaPay. La única diferencia es lo que
 * hay antes. Quien ya tiene negocio cae directo en el pago; quien no, pasa
 * antes por el alta —QvaPay cobra a nombre de un negocio, así que no hay
 * factura posible sin él— y la elección viaja en la URL hasta esa sección.
 *
 * Los servicios de `estado: "proximo"` no se venden: se enseñan con su etiqueta
 * y el CTA es pedir el aviso por WhatsApp.
 */
export function CatalogoServicios({ catalogo, autenticado, tieneNegocio }: Props) {
  const [filtro, setFiltro] = useState<string>("todas");

  const visibles =
    filtro === "todas"
      ? CATEGORIAS
      : CATEGORIAS.filter((c) => c.slug === filtro);

  /** El destino de pago (o de alta) con la pieza ya elegida. */
  function hrefPago(plan?: Pack, modulos: readonly ClaveModulo[] = []): string {
    const qs = plan
      ? `plan=${plan}`
      : modulos.length > 0
        ? `modulos=${modulos.join(",")}`
        : "";

    if (autenticado && tieneNegocio) {
      return `/business?seccion=planes${qs ? `&${qs}` : ""}`;
    }
    const onboarding = `/onboarding${qs ? `?${qs}` : ""}`;
    return autenticado ? onboarding : `/register?next=${encodeURIComponent(onboarding)}`;
  }

  function ctaServicio(servicio: ServicioCatalogo) {
    if (servicio.estado === "proximo") {
      const texto = `Hola, quiero saber cuándo estará «${servicio.nombre}» en La Verde`;
      return {
        texto: "Avísame",
        href: `${whatsappHref(SUPPORT_WHATSAPP)}?text=${encodeURIComponent(texto)}`,
        externo: true,
      };
    }
    if (servicio.modulo) {
      const dest = hrefPago(undefined, [servicio.modulo]);
      if (autenticado && tieneNegocio) return { texto: "Ir a planes", href: dest, externo: false };
      if (autenticado) return { texto: "Continuar", href: dest, externo: false };
      return { texto: "Comenzar", href: dest, externo: false };
    }
    if (servicio.plan) {
      const dest = hrefPago(servicio.plan);
      if (autenticado && tieneNegocio) return { texto: `Con ${catalogo.packs[servicio.plan].nombre}`, href: dest, externo: false };
      if (autenticado) return { texto: "Continuar", href: dest, externo: false };
      return { texto: "Comenzar", href: dest, externo: false };
    }
    return {
      texto: autenticado && tieneNegocio ? "Ir al panel" : "Empezar gratis",
      href: autenticado && tieneNegocio ? "/business" : hrefPago(),
      externo: false,
    };
  }

  function totalPack(categoria: CategoriaServicios) {
    return categoria.pack.modulos.reduce(
      (suma, clave) => suma + catalogo.modulos[clave].usd,
      0,
    );
  }

  return (
    <div>
      {/* Filtros */}
      <p className="mt-8 text-small font-semibold text-ink">Categoría</p>
      <div
        className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
        role="group"
        aria-label="Filtrar por categoría de negocio"
      >
        <button
          type="button"
          onClick={() => setFiltro("todas")}
          aria-pressed={filtro === "todas"}
          className={cn(
            "inline-flex shrink-0 min-h-10 items-center rounded-full border px-4 font-lv-display text-small font-semibold transition duration-300 ease-outquint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/60",
            filtro === "todas"
              ? "border-verde-500 bg-verde-50 text-verde-700"
              : "border-ink/10 bg-white text-ink-soft/80 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
          )}
        >
          Todas
        </button>
        {CATEGORIAS.map((categoria) => (
          <button
            key={categoria.slug}
            type="button"
            onClick={() => setFiltro(categoria.slug)}
            aria-pressed={filtro === categoria.slug}
            className={cn(
              "inline-flex shrink-0 min-h-10 items-center rounded-full border px-4 font-lv-display text-small font-semibold transition duration-300 ease-outquint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/60",
              filtro === categoria.slug
                ? "border-verde-500 bg-verde-50 text-verde-700"
                : "border-ink/10 bg-white text-ink-soft/80 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
            )}
          >
            {categoria.corto}
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-14">
        {visibles.map((categoria) => {
          const disponibles = categoria.servicios.filter((s) => s.estado === "ya").length;
          const enCamino = categoria.servicios.length - disponibles;

          return (
            <section key={categoria.slug} className="scroll-mt-24">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-ink/10 pb-4">
                <div>
                  <h2 className="font-lv-display text-h3 font-bold tracking-[-0.02em] text-ink">
                    {categoria.nombre}
                  </h2>
                  <p className="mt-1 max-w-2xl text-small text-ink-soft/75">
                    {categoria.descripcion}
                  </p>
                </div>
                <span className="lv-mono rounded-full border border-ink/10 bg-white px-3 py-1 text-[11px] text-ink-soft/70">
                  {disponibles} disponibles
                  {enCamino > 0 ? ` · ${enCamino} en camino` : ""}
                </span>
              </div>

              <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {categoria.servicios.map((servicio) => {
                  const cta = ctaServicio(servicio);
                  const proximo = servicio.estado === "proximo";
                  const lema = servicio.modulo
                    ? catalogo.modulos[servicio.modulo]?.lema
                    : servicio.plan
                      ? catalogo.packs[servicio.plan]?.lema
                      : undefined;
                  const precioUsdVal = servicio.modulo
                    ? catalogo.modulos[servicio.modulo]?.usd
                    : undefined;
                  return (
                    <li
                      key={servicio.nombre}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className={cn(
                          "text-small font-medium leading-snug",
                          proximo ? "text-ink-soft/50" : "text-ink",
                        )}>
                          {servicio.nombre}
                        </p>
                        {lema && !proximo && (
                          <p className="mt-0.5 text-[11px] leading-snug text-ink-soft/55">
                            {lema}
                          </p>
                        )}
                        {servicio.ficha && !proximo && (
                          <Link
                            href={`/servicios/${servicio.ficha}`}
                            className="mt-1.5 inline-flex min-h-8 items-center gap-1 rounded-full border border-ink/10 bg-white px-3 text-[11px] font-semibold text-ink-soft/80 transition duration-300 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/60"
                          >
                            Cómo funciona
                            <ArrowUpRight size={11} strokeWidth={2.2} aria-hidden />
                          </Link>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                        {proximo ? (
                          <span className="rounded-full bg-sand-deep px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft/70">
                            Próximamente
                          </span>
                        ) : precioUsdVal !== undefined ? (
                          <span className="text-right">
                            <span className="block text-[13px] font-bold text-ink">
                              {precioUsd(precioUsdVal)}{" "}
                              <span className="text-[11px] font-medium text-ink-soft/60">USD</span>
                            </span>
                            <span className="block text-[10px] text-ink-soft/50">/mes</span>
                          </span>
                        ) : !servicio.plan ? (
                          <span className="text-[11px] font-semibold text-verde-700">Gratis</span>
                        ) : null}
                        <Link
                          href={cta.href}
                          {...(cta.externo
                            ? { target: "_blank", rel: "noopener noreferrer" }
                            : {})}
                          className="inline-flex min-h-9 items-center justify-center rounded-full border border-ink/15 px-3 text-[11px] font-semibold text-ink transition duration-300 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/60"
                        >
                          {cta.texto}
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr]">
                {/* Pack sugerido de la categoría */}
                <article className="relative flex flex-col rounded-2xl border border-ink bg-ink p-6 text-white shadow-card dark:border-white/10 dark:bg-[#12241a]">
                  <p className="lv-mono text-[11px] uppercase tracking-[0.18em] text-verde-300">
                    Pack sugerido
                  </p>
                  <h3 className="mt-2 font-lv-display text-h3 font-bold tracking-[-0.02em]">
                    {categoria.pack.nombre}
                  </h3>
                  <p className="mt-1 text-small text-white/65">
                    {categoria.pack.lema}
                  </p>

                  <ul className="mt-4 space-y-2">
                    {categoria.pack.completa.map((punto) => (
                      <li
                        key={punto}
                        className="flex gap-2 text-[13px] leading-snug text-white/75"
                      >
                        <Check
                          size={14}
                          strokeWidth={2.4}
                          className="mt-0.5 shrink-0 text-verde-300"
                          aria-hidden
                        />
                        {punto}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 rounded-2xl bg-white/5 p-3">
                    <ul className="space-y-1.5">
                      {categoria.pack.modulos.map((clave) => (
                        <li
                          key={clave}
                          className="flex items-baseline justify-between gap-3 text-[12px]"
                        >
                          <span className="text-white/75">
                            {catalogo.modulos[clave].nombre}
                          </span>
                          <span className="shrink-0 font-semibold text-white/85">
                            {precioUsd(catalogo.modulos[clave].usd)} USD
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-white/10 pt-2">
                      <span className="text-small text-white/60">
                        {categoria.pack.modulos.length} servicios
                      </span>
                      <span className="font-lv-display text-lg font-bold">
                        {precioUsd(totalPack(categoria))} USD
                        <span className="text-[11px] font-medium text-white/55">
                          {" "}
                          /mes
                        </span>
                      </span>
                    </div>
                  </div>

                  <Link
                    href={hrefPago(undefined, categoria.pack.modulos)}
                    className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-verde-400 px-5 font-lv-display text-small font-semibold text-verde-950 transition duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
                  >
                    Contratar y pagar
                    <ArrowUpRight size={15} strokeWidth={2.2} aria-hidden />
                  </Link>
                </article>

                {/* Packs estándar, iguales para todas las categorías */}
                <aside className="rounded-2xl border border-ink/10 bg-sand/40 p-6">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-verde-600" aria-hidden />
                    <h3 className="font-lv-display text-body font-bold tracking-[-0.01em] text-ink">
                      O un pack estándar
                    </h3>
                  </div>
                  <p className="mt-1 text-small text-ink-soft/75">
                    Sirven para cualquier categoría y ya llevan las funciones
                    juntas, con descuento.
                  </p>

                  <ul className="mt-4 space-y-2">
                    {PACKS_ESTANDAR.map((clave) => {
                      const pack = catalogo.packs[clave];
                      return (
                        <li key={clave}>
                          <Link
                            href={hrefPago(clave)}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3 transition-colors duration-300 hover:border-verde-300"
                          >
                            <span className="min-w-0">
                              <span className="block font-lv-display text-small font-semibold text-ink">
                                {pack.nombre}
                              </span>
                              <span className="block truncate text-[11px] text-ink-soft/70">
                                {pack.lema}
                              </span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="block text-small font-semibold text-ink">
                                {precioUsd(pack.usd)} USD
                              </span>
                              <span className="block text-[10px] text-ink-soft/60">
                                {textoCup(pack.usd, catalogo)} / mes
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </aside>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
