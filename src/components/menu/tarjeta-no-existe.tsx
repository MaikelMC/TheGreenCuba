import { Stamp } from "lucide-react";

/**
 * El mensaje de «esta tarjeta ya no existe».
 *
 * Sirve para el 404 del servidor y para cuando la isla de la tarjeta descubre
 * —sin recargar— que el cliente se borró. No dice cuál de las cosas pasó:
 * token inventado, cliente borrado o negocio sin la tarjeta.
 */
export function NoExiste() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-gap-md px-gap-md py-gap-xl">
      <span className="grid size-14 place-items-center rounded-2xl bg-sand-deep text-ink-soft/50">
        <Stamp size={26} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h1 className="text-center font-lv-display text-h3 font-bold text-ink">
        Esta tarjeta ya no existe
      </h1>
      <p className="max-w-[34ch] text-center text-small text-ink-soft/75">
        Puede que el negocio la haya borrado. Pídele que te dé una nueva la
        próxima vez que compres.
      </p>
    </main>
  );
}
