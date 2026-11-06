"use client";

import Image from "next/image";
import { Briefcase, ExternalLink, Search, Star, Users } from "lucide-react";

/**
 * Tarjeta promocional de Kynari Empleos.
 *
 * Móvil: logo + título en fila, badge fijo en esquina inferior derecha.
 * Desktop: logo | cuerpo (título + badge + descripción + meta) | CTA.
 */
export function KynariCard() {
  return (
    <a
      href="https://kynariempleos.com"
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block overflow-hidden rounded-[26px] bg-[linear-gradient(116deg,#0d0a00_0%,#1a1200_55%,#2a1e00_100%)] p-gap-md shadow-card ring-1 ring-white/[0.03] transition-shadow duration-500 ease-outquint hover:shadow-[0_4px_32px_rgba(201,168,76,0.22)] sm:p-gap-lg"
    >
      {/* Adorno radial dorado — esquina superior derecha */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-[70px] -top-[180px] size-[300px] rounded-full bg-[radial-gradient(circle,rgba(201,168,76,0.22),rgba(201,168,76,0)_68%)]"
      />
      {/* Adorno radial tenue — esquina inferior izquierda */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-[160px] left-[80px] size-[220px] rounded-full border border-[#c9a84c]/15 shadow-[0_0_0_24px_rgba(201,168,76,0.03),0_0_0_50px_rgba(201,168,76,0.02)]"
      />

      {/* ── Layout móvil ─────────────────────────────────────────────── */}
      <div className="relative sm:hidden">
        {/* Fila: logo + título */}
        <div className="flex items-center gap-gap-sm">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-[16px] border border-[#c9a84c]/25 bg-white/5 p-[5px] shadow-[0_6px_20px_rgba(0,0,0,0.3)]">
            <Image
              src="/kynari-logo.png"
              alt="Kynari Empleos"
              width={36}
              height={36}
              className="size-[30px] object-contain"
            />
          </div>
          <span className="font-lv-display text-[17px] font-bold leading-snug text-[#f0d080]">
            ¿Tu negocio necesita personal?
          </span>
        </div>

        {/* Descripción */}
        <p className="mt-gap-sm text-small leading-snug text-white/55">
          Publica tu oferta y llega a profesionales que buscan empleo en Cuba.
          La oferta aparece también en tu ficha de La Verde.
        </p>

        {/* Meta + CTA en fila */}
        <div className="mt-gap-sm flex items-center justify-between gap-gap-sm">
          <div className="flex flex-col gap-[3px]">
            <span className="flex items-center gap-[5px] text-meta text-[#c9a84c]/60">
              <Briefcase size={11} strokeWidth={1.8} className="shrink-0" />
              Publica gratis
            </span>
            <span className="flex items-center gap-[5px] text-meta text-[#c9a84c]/60">
              <Users size={11} strokeWidth={1.8} className="shrink-0" />
              Candidatos que llegan a ti
            </span>
          </div>
          <span className="inline-flex items-center gap-[5px] rounded-full bg-[linear-gradient(135deg,#c9a84c_0%,#f0d080_50%,#c9a84c_100%)] px-gap-sm py-[8px] font-lv-display text-meta font-semibold text-[#0a0800] shadow-[0_4px_16px_rgba(201,168,76,0.4)]">
            Ver Kynari
            <ExternalLink size={12} strokeWidth={2} className="shrink-0" />
          </span>
        </div>

      </div>

      {/* ── Layout desktop ────────────────────────────────────────────── */}
      <div className="relative hidden items-center gap-gap-lg sm:flex">
        {/* Logo */}
        <div className="flex size-[68px] shrink-0 items-center justify-center rounded-[20px] border border-[#c9a84c]/25 bg-white/5 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
          <Image
            src="/kynari-logo.png"
            alt="Kynari Empleos"
            width={48}
            height={48}
            className="size-12 object-contain"
          />
        </div>

        {/* Cuerpo */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-gap-xs">
            <span className="font-lv-display text-body font-bold text-[#f0d080]">
              ¿Tu negocio necesita personal?
            </span>
            <span className="rounded-full border border-[#c9a84c]/30 bg-[#c9a84c]/10 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c9a84c]">
              Kynari Empleos
            </span>
          </div>
          <p className="mt-[5px] max-w-[56ch] text-small leading-snug text-white/55">
            Publica tu oferta y llega a profesionales que buscan empleo en
            Cuba. La oferta aparece también en tu ficha de La Verde para
            que cualquier visitante pueda postularse.
          </p>
          <div className="mt-gap-sm flex flex-wrap items-center gap-gap-md">
            <span className="flex items-center gap-[5px] text-meta text-[#c9a84c]/60">
              <Briefcase size={12} strokeWidth={1.8} className="shrink-0" />
              Publica gratis
            </span>
            <span className="flex items-center gap-[5px] text-meta text-[#c9a84c]/60">
              <Users size={12} strokeWidth={1.8} className="shrink-0" />
              Candidatos que llegan a ti
            </span>
          </div>
        </div>

        {/* CTA */}
        <div className="shrink-0">
          <span className="inline-flex items-center gap-[6px] rounded-full bg-[linear-gradient(135deg,#c9a84c_0%,#f0d080_50%,#c9a84c_100%)] px-gap-md py-[10px] font-lv-display text-small font-semibold text-[#0a0800] shadow-[0_4px_20px_rgba(201,168,76,0.4)] transition-all duration-500 ease-outquint group-hover:shadow-[0_6px_28px_rgba(201,168,76,0.55)]">
            Ver Kynari
            <ExternalLink size={13} strokeWidth={2} className="shrink-0" />
          </span>
        </div>
      </div>
    </a>
  );
}

/**
 * Variante para el perfil de usuario: invita al candidato a buscar empleo,
 * no al dueño a publicar. Mismo sistema visual (dorado/negro), copy distinto.
 */
export function KynariEmpleosCard() {
  return (
    <a
      href="https://kynariempleos.com"
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block overflow-hidden rounded-[26px] bg-[linear-gradient(116deg,#0d0a00_0%,#1a1200_55%,#2a1e00_100%)] p-gap-md shadow-card ring-1 ring-white/[0.03] transition-shadow duration-500 ease-outquint hover:shadow-[0_4px_32px_rgba(201,168,76,0.22)] sm:p-gap-lg"
    >
      {/* Adorno radial dorado */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-[70px] -top-[180px] size-[300px] rounded-full bg-[radial-gradient(circle,rgba(201,168,76,0.22),rgba(201,168,76,0)_68%)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-[160px] left-[80px] size-[220px] rounded-full border border-[#c9a84c]/15 shadow-[0_0_0_24px_rgba(201,168,76,0.03),0_0_0_50px_rgba(201,168,76,0.02)]"
      />

      {/* ── Móvil ──────────────────────────────────────────────────────── */}
      <div className="relative sm:hidden">
        <div className="flex items-center gap-gap-sm">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-[16px] border border-[#c9a84c]/25 bg-white/5 p-[5px] shadow-[0_6px_20px_rgba(0,0,0,0.3)]">
            <Image
              src="/kynari-logo.png"
              alt="Kynari Empleos"
              width={36}
              height={36}
              className="size-[30px] object-contain"
            />
          </div>
          <span className="font-lv-display text-[17px] font-bold leading-snug text-[#f0d080]">
            ¿Buscas empleo?
          </span>
        </div>

        <p className="mt-gap-sm text-small leading-snug text-white/55">
          Encuentra ofertas de trabajo en negocios cerca de ti. Postúlate
          directamente desde la ficha del negocio en La Verde.
        </p>

        <div className="mt-gap-sm flex items-center justify-between gap-gap-sm">
          <div className="flex flex-col gap-[3px]">
            <span className="flex items-center gap-[5px] text-meta text-[#c9a84c]/60">
              <Search size={11} strokeWidth={1.8} className="shrink-0" />
              Busca por sector o zona
            </span>
            <span className="flex items-center gap-[5px] text-meta text-[#c9a84c]/60">
              <Star size={11} strokeWidth={1.8} className="shrink-0" />
              Postúlate con un clic
            </span>
          </div>
          <span className="inline-flex items-center gap-[5px] rounded-full bg-[linear-gradient(135deg,#c9a84c_0%,#f0d080_50%,#c9a84c_100%)] px-gap-sm py-[8px] font-lv-display text-meta font-semibold text-[#0a0800] shadow-[0_4px_16px_rgba(201,168,76,0.4)]">
            Ver ofertas
            <ExternalLink size={12} strokeWidth={2} className="shrink-0" />
          </span>
        </div>
      </div>

      {/* ── Desktop ────────────────────────────────────────────────────── */}
      <div className="relative hidden items-center gap-gap-lg sm:flex">
        <div className="flex size-[68px] shrink-0 items-center justify-center rounded-[20px] border border-[#c9a84c]/25 bg-white/5 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
          <Image
            src="/kynari-logo.png"
            alt="Kynari Empleos"
            width={48}
            height={48}
            className="size-12 object-contain"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-gap-xs">
            <span className="font-lv-display text-body font-bold text-[#f0d080]">
              ¿Buscas empleo?
            </span>
            <span className="rounded-full border border-[#c9a84c]/30 bg-[#c9a84c]/10 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c9a84c]">
              Kynari Empleos
            </span>
          </div>
          <p className="mt-[5px] max-w-[56ch] text-small leading-snug text-white/55">
            Encuentra ofertas de trabajo en negocios cerca de ti y postúlate
            directamente desde su ficha en La Verde.
          </p>
          <div className="mt-gap-sm flex flex-wrap items-center gap-gap-md">
            <span className="flex items-center gap-[5px] text-meta text-[#c9a84c]/60">
              <Search size={12} strokeWidth={1.8} className="shrink-0" />
              Busca por sector o zona
            </span>
            <span className="flex items-center gap-[5px] text-meta text-[#c9a84c]/60">
              <Star size={12} strokeWidth={1.8} className="shrink-0" />
              Postúlate con un clic
            </span>
          </div>
        </div>

        <div className="shrink-0">
          <span className="inline-flex items-center gap-[6px] rounded-full bg-[linear-gradient(135deg,#c9a84c_0%,#f0d080_50%,#c9a84c_100%)] px-gap-md py-[10px] font-lv-display text-small font-semibold text-[#0a0800] shadow-[0_4px_20px_rgba(201,168,76,0.4)] transition-all duration-500 ease-outquint group-hover:shadow-[0_6px_28px_rgba(201,168,76,0.55)]">
            Ver ofertas
            <ExternalLink size={13} strokeWidth={2} className="shrink-0" />
          </span>
        </div>
      </div>
    </a>
  );
}
