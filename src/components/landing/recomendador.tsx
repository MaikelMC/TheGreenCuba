"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Loader2, AlertCircle, MessageCircle } from "lucide-react";
import { SUPPORT_WHATSAPP } from "@/lib/legal";
import { whatsappHref } from "@/lib/contact-links";
import type {
  RespuestaRecomendacion,
  ServicioRecomendadoYa,
  ServicioRecomendadoProximo,
} from "@/app/api/recomendar-servicios/route";

/** Categorías con slug (clave para el route) + label (lo que ve el usuario). */
const CATEGORIAS = [
  { slug: "restaurante", label: "Restaurante o paladar" },
  { slug: "cafeteria", label: "Cafetería" },
  { slug: "comida-a-domicilio", label: "Comida a domicilio" },
  { slug: "dulceria", label: "Dulcería / Repostería" },
  { slug: "bar", label: "Bar o club" },
  { slug: "barberia", label: "Barbería / Salón de belleza" },
  { slug: "hostal", label: "Hostal o renta de habitaciones" },
  { slug: "servicios-tecnicos", label: "Servicios técnicos" },
  { slug: "taller", label: "Taller mecánico o ponchera" },
  { slug: "ropa", label: "Tienda de ropa, calzado o accesorios" },
  { slug: "ferreteria", label: "Ferretería o materiales" },
  { slug: "gimnasio", label: "Gimnasio, academia o clases" },
  { slug: "transporte", label: "Transporte o mensajería" },
  { slug: "fotografia", label: "Fotografía, eventos o decoración" },
  { slug: "alimentos", label: "Venta de alimentos y productos" },
  { slug: "cualquier-negocio", label: "Otro tipo de negocio" },
] as const;

type Slug = (typeof CATEGORIAS)[number]["slug"];

type Estado = "idle" | "cargando" | "resultado" | "error";

/** «3,5» con coma, como el resto del sitio. */
function precioStr(usd: number) {
  return usd % 1 === 0 ? String(usd) : usd.toFixed(1).replace(".", ",");
}

export function Recomendador() {
  const [estado, setEstado] = useState<Estado>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [resultado, setResultado] = useState<RespuestaRecomendacion | null>(null);

  const [categoriaSlug, setCategoriaSlug] = useState<Slug | "">("");
  const [descripcion, setDescripcion] = useState("");
  const [problemas, setProblemas] = useState("");

  const categoriaLabel =
    CATEGORIAS.find((c) => c.slug === categoriaSlug)?.label ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEstado("cargando");
    setErrorMsg("");

    try {
      const res = await fetch("/api/recomendar-servicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoriaSlug,
          categoria: categoriaLabel,
          descripcion,
          problemas,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      const data = (await res.json()) as RespuestaRecomendacion;
      setResultado(data);
      setEstado("resultado");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error inesperado");
      setEstado("error");
    }
  }

  function resetear() {
    setEstado("idle");
    setResultado(null);
  }

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-container px-gutter md:px-gutter-lg">
        {/* Encabezado */}
        <div className="mb-10 max-w-2xl">
          <p className="lv-mono text-[11px] uppercase tracking-[0.2em] text-verde-700">
            Diagnóstico gratuito
          </p>
          <h2 className="mt-3 font-lv-display text-[clamp(28px,4.5vw,48px)] font-bold leading-[1.08] tracking-[-0.03em] text-ink text-balance">
            ¿Qué necesita exactamente tu negocio?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-soft/75 text-pretty">
            Cuéntanos cómo funciona y la IA analiza nuestros servicios para armar
            el pack ideal para ti.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-12">
          {/* Formulario */}
          <div
            className={[
              "rounded-3xl border border-ink/10 bg-white p-6 shadow-soft sm:p-8",
              estado === "resultado" ? "lg:self-start" : "",
            ].join(" ")}
          >
            {estado !== "resultado" ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* Categoría */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="recom-categoria"
                    className="text-sm font-medium text-ink"
                  >
                    Categoría del negocio
                  </label>
                  <select
                    id="recom-categoria"
                    required
                    value={categoriaSlug}
                    onChange={(e) => setCategoriaSlug(e.target.value as Slug)}
                    className="rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm text-ink transition focus:border-verde-400 focus:outline-none focus:ring-2 focus:ring-verde-400/20 dark:border-white/10"
                  >
                    <option value="" disabled>
                      Elige una categoría…
                    </option>
                    {CATEGORIAS.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Descripción */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="recom-descripcion"
                    className="text-sm font-medium text-ink"
                  >
                    ¿Cómo funciona tu negocio?
                  </label>
                  <textarea
                    id="recom-descripcion"
                    required
                    rows={3}
                    minLength={20}
                    maxLength={800}
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Ej: Tenemos un restaurante familiar con menú fijo, atendemos a domicilio y en el local…"
                    className="resize-none rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/55 transition focus:border-verde-400 focus:outline-none focus:ring-2 focus:ring-verde-400/20 dark:border-white/10 dark:placeholder:text-white/35"
                  />
                </div>

                {/* Problemas */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="recom-problemas"
                    className="text-sm font-medium text-ink"
                  >
                    ¿Qué problemas quieres resolver?
                  </label>
                  <textarea
                    id="recom-problemas"
                    required
                    rows={3}
                    minLength={20}
                    maxLength={800}
                    value={problemas}
                    onChange={(e) => setProblemas(e.target.value)}
                    placeholder="Ej: Los clientes no saben qué tenemos disponible hoy, tardamos en responder pedidos por WhatsApp…"
                    className="resize-none rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/55 transition focus:border-verde-400 focus:outline-none focus:ring-2 focus:ring-verde-400/20 dark:border-white/10 dark:placeholder:text-white/35"
                  />
                </div>

                {estado === "error" && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={estado === "cargando"}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition duration-300 ease-outquint hover:bg-ink-soft active:scale-[0.98] disabled:opacity-50"
                >
                  {estado === "cargando" ? (
                    <>
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                      Analizando…
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} aria-hidden />
                      Analizar mi negocio
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Resumen del negocio analizado */
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-verde-600" aria-hidden />
                  <span className="text-sm font-medium text-ink">
                    Negocio analizado
                  </span>
                </div>
                <div className="space-y-1 text-sm text-ink-soft/75">
                  <p>
                    <span className="font-medium text-ink">Categoría:</span>{" "}
                    {categoriaLabel}
                  </p>
                  <p className="line-clamp-2">
                    <span className="font-medium text-ink">Descripción:</span>{" "}
                    {descripcion}
                  </p>
                </div>
                <button
                  onClick={resetear}
                  className="text-left text-xs font-medium text-verde-700 underline-offset-2 hover:underline"
                >
                  Cambiar datos
                </button>
              </div>
            )}
          </div>

          {/* Resultados */}
          <div>
            {estado === "idle" && (
              <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-ink/15 p-10">
                <p className="text-center text-sm text-ink-soft/60">
                  Completa el formulario y la IA armará tu pack ideal.
                </p>
              </div>
            )}

            {estado === "cargando" && (
              <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-ink/15 p-10">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={24} className="animate-spin text-verde-600" aria-hidden />
                  <p className="text-sm text-ink-soft/70">
                    Analizando tu negocio…
                  </p>
                </div>
              </div>
            )}

            {estado === "error" && (
              <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-red-200 p-10 dark:border-red-900/50">
                <p className="text-center text-sm text-ink-soft/70">
                  No se pudo generar la recomendación. Inténtalo de nuevo.
                </p>
              </div>
            )}

            {estado === "resultado" && resultado && (
              <ResultadoRecomendacion resultado={resultado} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ResultadoRecomendacion({ resultado }: { resultado: RespuestaRecomendacion }) {
  const hayProximos = resultado.servicios.some((s) => s.esProximo);
  const serviciosYa = resultado.servicios.filter((s): s is ServicioRecomendadoYa => !s.esProximo);

  /* Los módulos del pack recomendado viajan a onboarding en la URL, igual que
     el selector de servicios y las tarjetas de plan. Sin esto, el diagnóstico
     se perdía al registrarse y el usuario llegaba a onboarding en blanco. */
  const modulos = [...new Set(serviciosYa.map((s) => s.claveModulo))];
  const registerHref =
    modulos.length > 0
      ? `/register?next=${encodeURIComponent(`/onboarding?modulos=${modulos.join(",")}`)}`
      : "/register";

  return (
    <div className="flex flex-col gap-4">
      {/* Tarjetas de servicios */}
      {resultado.servicios.map((s, i) =>
        s.esProximo ? (
          <TarjetaProximo key={i} servicio={s} />
        ) : (
          <TarjetaYa key={s.slug} servicio={s} />
        ),
      )}

      {/* Pack price + CTA */}
      <div className="mt-2 rounded-2xl border border-verde-200 bg-verde-50 px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-verde-700">
              Pack recomendado
            </p>
            {serviciosYa.length > 0 ? (
              <>
                <p className="mt-1 font-lv-display text-2xl font-bold text-ink">
                  ${precioStr(resultado.totalUsd)}
                  <span className="ml-1 text-sm font-normal text-ink-soft/60">
                    / mes
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-ink-soft/60">
                  {serviciosYa.length} servicio{serviciosYa.length !== 1 ? "s" : ""} activos
                  {hayProximos && " · más al contactar al equipo"}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-ink-soft/75">
                Todos los servicios recomendados están en desarrollo.
                <br />
                Contáctanos para reservar tu lugar.
              </p>
            )}
          </div>
          <Link
            href={registerHref}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-verde-400 px-6 py-3 text-sm font-semibold text-verde-950 transition duration-300 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
          >
            Empezar ahora
            <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </div>

      {/* Plan gratis — siempre disponible */}
      <div className="rounded-2xl border border-ink/10 bg-sand/40 px-5 py-4">
        <p className="text-sm text-ink-soft/75">
          <span className="font-medium text-ink">Plan gratis incluido:</span>{" "}
          pin en el mapa, ficha completa, búsqueda con IA y catálogo hasta 15 productos.{" "}
          <Link
            href="/register"
            className="font-medium text-verde-700 underline-offset-2 hover:underline"
          >
            Todos los negocios lo disfrutan desde el primer día.
          </Link>
        </p>
      </div>
    </div>
  );
}

function TarjetaYa({ servicio }: { servicio: ServicioRecomendadoYa }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-lv-display text-sm font-semibold text-ink">
          {servicio.nombre}
        </span>
        {servicio.esIncluido ? (
          <span className="rounded-full bg-sand-deep px-2 py-0.5 text-[11px] font-medium text-ink-soft/70">
            Incluido en {servicio.nombreModulo}
          </span>
        ) : (
          <span className="rounded-full bg-verde-100 px-2 py-0.5 text-[11px] font-medium text-verde-700">
            ${precioStr(servicio.precioUsd)}/mes
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft/75">
        {servicio.explicacion}
      </p>
      {servicio.ficha && (
        <Link
          href={`/servicios/${servicio.ficha}`}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-verde-700 underline-offset-2 hover:underline"
        >
          Ver cómo funciona
          <ArrowRight size={11} aria-hidden />
        </Link>
      )}
    </div>
  );
}

function TarjetaProximo({ servicio }: { servicio: ServicioRecomendadoProximo }) {
  const texto = `Hola, me interesa implementar "${servicio.nombre}" en mi negocio a través de La Verde. ¿Podemos hablar?`;
  const whatsappUrl = `${whatsappHref(SUPPORT_WHATSAPP)}?text=${encodeURIComponent(texto)}`;

  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-lv-display text-sm font-semibold text-ink">
              {servicio.nombre}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft/75">
            {servicio.explicacion}
          </p>
        </div>
        {/* CTA WhatsApp inline en la tarjeta */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink/10 px-3 py-1.5 text-[11px] font-semibold text-verde-700 transition hover:bg-verde-50"
        >
          <MessageCircle size={12} aria-hidden />
          Contactar al equipo
        </a>
      </div>
    </div>
  );
}
