/**
 * Lo que se ve mientras la carta se sirve.
 *
 * La página va con `revalidate = 300`, así que casi todas las visitas llegan con
 * el HTML ya hecho y esto no llega a pintarse. Se pinta la primera, que es la
 * peor: la que abre la carta desde un QR recién repartido, con la caché en frío
 * y datos móviles. Sin esto esa visita se queda mirando una pantalla en blanco
 * sin saber si la carta existe.
 *
 * Es un esqueleto y no un cargador giratorio: dibuja la forma de lo que viene
 * —la tarjeta del negocio, el titular, la rejilla de dos columnas— y así el
 * contenido aterriza donde ya estaba el hueco, sin dar un salto.
 *
 * Sin la cabecera de marca ni el disco de tema: son controles, y uno que
 * todavía no responde es peor que uno que aparece un segundo más tarde.
 */
export default function Loading() {
  return (
    <div
      role="status"
      className="mx-auto w-full max-w-[680px] animate-pulse px-gutter py-gap-lg motion-reduce:animate-none"
    >
      <span className="sr-only">Cargando el menú…</span>

      {/* La tarjeta del negocio: la marca, el nombre y la fila de contacto. */}
      <div className="rounded-3xl border border-ink/5 bg-white p-gap-md shadow-soft">
        <div className="flex items-center gap-gap-md">
          <span className="size-14 shrink-0 rounded-full bg-sand-deep" />
          <div className="min-w-0 flex-1 space-y-gap-xs">
            <span className="block h-7 w-3/5 rounded-full bg-sand-deep" />
            <span className="block h-4 w-2/5 rounded-full bg-sand" />
          </div>
        </div>

        <div className="mt-gap-md grid grid-cols-2 gap-gap-xs sm:flex sm:flex-wrap">
          <span className="h-10 rounded-full bg-sand sm:w-40" />
          <span className="h-10 rounded-full bg-sand sm:w-40" />
        </div>
      </div>

      {/* El titular de la sección y las dos columnas de tarjetas. */}
      <div className="mt-gap-lg">
        <span className="block h-6 w-28 rounded-full bg-sand-deep" />
        <div className="mt-gap-sm grid grid-cols-2 gap-gap-sm">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="block aspect-[3/4] rounded-2xl border border-ink/10 bg-white"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
