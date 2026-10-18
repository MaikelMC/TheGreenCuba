import { Skeleton } from "@/components/ui";

/**
 * Armazón de las rutas públicas que no traen su propio `loading.tsx`.
 *
 * Antes era un spinner centrado con «Cargando…»: decía que algo pasaba, no
 * qué iba a aparecer, y al llegar los datos la pantalla saltaba entera. Este
 * repite la forma más común de estas páginas —título, fila de filtros y una
 * lista de tarjetas— para que el contenido aterrice donde ya hay hueco.
 *
 * Los bloques van `aria-hidden` desde `Skeleton`; lo único que anuncia el
 * lector de pantalla es el `role="status"`, y una sola vez.
 */
export default function MainLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-gutter py-gap-lg" aria-busy>
      <span role="status" className="sr-only">
        Cargando…
      </span>

      <Skeleton className="h-8 w-[55%]" />
      <Skeleton className="mt-gap-xs h-4 w-[75%]" />

      <div className="mt-gap-md flex flex-wrap gap-gap-xs">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-16 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>

      <div className="mt-gap-md grid gap-gap-sm sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    </div>
  );
}
