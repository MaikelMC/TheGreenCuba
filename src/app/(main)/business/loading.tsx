import { Skeleton } from "@/components/ui";

/**
 * Lo que se ve mientras `/business` resuelve sus consultas.
 *
 * El segmento padre ya tenía un `loading.tsx`, pero el suyo es un spinner
 * centrado con «Cargando…»: dice que algo pasa, no *qué* va a aparecer, y al
 * llegar los datos la pantalla salta entera. Este repite la maqueta del panel
 * —cabecera, barra lateral, el ancho de las cuatro tarjetas— con las mismas
 * medidas, así que el cambio no mueve nada de sitio.
 *
 * Es un componente de servidor y no monta nada de cliente: cero JavaScript
 * para una pantalla que, por definición, dura poco. Los bloques van
 * `aria-hidden` y el aviso real lo da el `role="status"`, que es lo único que
 * un lector de pantalla tiene que anunciar.
 */
export default function BusinessLoading() {
  return (
    <div className="business-panel h-dvh bg-sand font-lv text-ink flex flex-col">
      <span role="status" className="sr-only">
        Cargando el panel…
      </span>

      <header className="safe-top h-header shrink-0 border-b border-ink/5 bg-sand-warm/90 flex items-center px-3 gap-2 sm:px-gap-md">
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="h-5 w-[150px]" />
        <div className="flex-1" />
        <Skeleton className="size-11 rounded-full" />
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden" aria-hidden>
        {/* La barra lateral: seis filas con el alto de los ítems del nav. */}
        <aside className="hidden lg:flex flex-col w-[260px] shrink-0 gap-[2px] border-r border-ink/5 bg-white px-gap-sm pt-gap-md">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-11 rounded-full" />
          ))}
        </aside>

        <main className="flex-1 min-w-0 overflow-hidden">
          <div className="flex flex-col gap-gap-md px-gap-sm pt-gap-sm sm:px-gap-md sm:pt-gap-md lg:px-gap-xl lg:pt-gap-xl">
            {/* El selector de negocio, que va encima de la vista. */}
            <Skeleton className="h-12" />

            {/* Las cuatro tarjetas de cifra. */}
            <div className="grid grid-cols-2 gap-gap-sm lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>

            {/* La cifra del mes y la fila de visitas y llamadas. */}
            <Skeleton className="h-20" />
            <Skeleton className="h-28" />

            {/* «Cómo apareces» y «Lo que puedes hacer ahora». */}
            <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
              <Skeleton className="h-52" />
              <Skeleton className="h-52" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
