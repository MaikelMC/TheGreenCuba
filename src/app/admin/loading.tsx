import { Skeleton } from "@/components/ui";

/**
 * Lo que se ve dentro del panel de administración mientras se resuelve la
 * sección.
 *
 * El armazón —cabecera y barra lateral— ya lo pinta `AdminShell`, así que aquí
 * solo va el contenido: la fila del título y la acción, las cuatro tarjetas de
 * cifra, la lista destacada y el gráfico. Antes era una tarjeta con un spinner
 * y, al llegar los datos, todo se recolocaba de golpe.
 *
 * Los bloques van `aria-hidden` desde `Skeleton`; el aviso lo da el
 * `role="status"`, una sola vez.
 */
export default function AdminLoading() {
  return (
    <div aria-busy>
      <span role="status" className="sr-only">
        Cargando el panel de administración…
      </span>

      <div className="mb-gap-md flex items-center justify-between gap-gap-sm">
        <Skeleton className="h-5 w-56 max-w-[60%]" />
        <Skeleton className="h-11 w-36 rounded-full" />
      </div>

      <div className="grid grid-cols-2 gap-gap-sm lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>

      <div className="mt-gap-lg">
        <Skeleton className="h-5 w-40" />
        <div className="mt-gap-sm space-y-gap-sm">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>

      <div className="mt-gap-lg grid grid-cols-1 gap-gap-md lg:grid-cols-3">
        <Skeleton className="h-56 lg:col-span-2" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}
