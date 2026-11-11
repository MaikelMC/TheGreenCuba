import { ExternalLink } from "lucide-react";

/**
 * La tasa del dólar en Cuba, en el propio panel.
 *
 * Es el widget oficial de **CambioCUP**, el servicio de QvaPay que alimenta la
 * tasa con la que se calculan los precios de planes y servicios. Se incrusta
 * solo aquí, en administración: en las páginas públicas el número se pinta con
 * la API (`/api/tasa-cambio`) y no con un iframe de terceros.
 *
 * El `title` no es decorativo: sin él, un lector de pantalla anuncia el marco
 * como «contenido insertado» y no dice qué hay dentro.
 */
export function CambioCupWidget() {
  return (
    <section className="overflow-hidden rounded-2xl border border-ink/5 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-gap-sm p-gap-md">
        <div>
          <h3 className="font-lv-display text-body font-semibold text-ink">
            Tasa del dólar
          </h3>
          <p className="mt-[2px] text-meta text-ink-soft/75">
            CambioCUP · QvaPay. Se actualiza cada 10 minutos.
          </p>
        </div>
        <a
          href="https://www.cambiocup.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-[4px] rounded-full border border-ink/10 px-gap-sm py-[6px] font-lv-display text-meta font-semibold text-ink transition duration-500 ease-outquint hover:border-verde-300 hover:text-verde-700"
        >
          Abrir
          <ExternalLink size={13} strokeWidth={2} aria-hidden />
        </a>
      </header>

      <iframe
        src="https://www.cambiocup.com"
        title="Tasa de cambio del dólar en Cuba, en tiempo real (CambioCUP)"
        width="100%"
        height={520}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block w-full border-t border-ink/5"
      />
    </section>
  );
}
