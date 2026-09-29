import Link from "next/link";
import { ArrowRight, Megaphone, Store } from "lucide-react";

interface BusinessEntryProps {
  hasBusiness?: boolean;
}

export function BusinessEntry({ hasBusiness = false }: BusinessEntryProps) {
  return (
    <section className="mx-auto flex w-full max-w-[980px] flex-col gap-gap-lg py-gap-md sm:py-gap-xl">
      <div className="max-w-[620px]">
        <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-verde-600">
          Espacio para creadores
        </p>
        <h1 className="mt-gap-xs font-lv-display text-[clamp(30px,5vw,52px)] font-bold leading-[0.98] tracking-[-0.03em] text-ink">
          ¿Qué quieres poner en el mapa?
        </h1>
        <p className="mt-gap-sm max-w-[560px] text-body leading-relaxed text-ink-soft/80">
          Elige si quieres presentar un lugar permanente o crear una experiencia temporal para que la gente la descubra.
        </p>
      </div>

      <div className="grid gap-gap-md md:grid-cols-2">
        <Link
          href="/profile?seccion=negocio"
          className="group flex min-h-[250px] flex-col justify-between rounded-[24px] border border-ink/10 bg-white p-gap-lg shadow-[0_18px_50px_-32px_rgba(20,42,30,0.55)] transition-all duration-500 ease-outquint hover:-translate-y-1 hover:border-verde-300 hover:shadow-[0_24px_60px_-30px_rgba(53,175,109,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400 focus-visible:ring-offset-2"
        >
          <div>
            <span className="grid size-12 place-items-center rounded-2xl bg-verde-50 text-verde-700">
              <Store size={24} strokeWidth={1.8} />
            </span>
            <h2 className="mt-gap-md font-lv-display text-[25px] font-bold tracking-[-0.02em] text-ink">
              {hasBusiness ? "Gestionar mi negocio" : "Tengo un negocio"}
            </h2>
            <p className="mt-gap-xs max-w-[360px] text-small leading-relaxed text-ink-soft/75">
              {hasBusiness
                ? "Consulta tu panel, actualiza tu ficha y revisa cómo te encuentran en La Verde."
                : "Crea una ficha permanente con tus horarios, fotos, servicios y formas de contacto."}
            </p>
          </div>
          <span className="flex items-center gap-gap-xs font-lv-display text-small font-semibold text-verde-700">
            {hasBusiness ? "Ir a mi ficha" : "Empezar"}
            <ArrowRight size={17} className="transition-transform duration-500 group-hover:translate-x-1" />
          </span>
        </Link>

        <div className="flex min-h-[250px] flex-col justify-between rounded-[24px] border border-ink/10 bg-ink p-gap-lg text-white shadow-[0_18px_50px_-32px_rgba(20,42,30,0.8)]">
          <div>
            <span className="grid size-12 place-items-center rounded-2xl bg-verde-300 text-verde-950">
              <Megaphone size={24} strokeWidth={1.8} />
            </span>
            <h2 className="mt-gap-md font-lv-display text-[25px] font-bold tracking-[-0.02em]">
              Crear una campaña
            </h2>
            <p className="mt-gap-xs max-w-[360px] text-small leading-relaxed text-white/70">
              Organiza un evento, una colaboración o una experiencia con fecha, ofertas y reservas.
            </p>
          </div>
          <span className="flex items-center gap-gap-xs font-lv-display text-small font-semibold text-verde-300">
            Próximamente
          </span>
        </div>
      </div>
    </section>
  );
}