import { Skeleton } from "@/components/ui";

/**
 * Armazón de «Notificaciones» durante la navegación.
 *
 * Mismo criterio que el skeleton interno de la vista: filas con la forma de
 * la lista real (icono circular + dos líneas), para que ni la barra superior
 * ni el contenido salten al llegar los datos.
 */
export default function NotificationsLoading() {
  return (
    <div className="min-h-dvh bg-sand font-lv text-ink" aria-busy>
      <div className="sticky top-0 z-20 flex h-header items-center gap-2 border-b border-ink/5 bg-sand-warm/90 px-3 backdrop-blur-[16px] sm:gap-gap-sm sm:px-gap-md">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <Skeleton className="h-[18px] w-[140px]" />
      </div>
      <div className="px-6 pt-2">
        <div className="flex items-center gap-1 border-b border-ink/10 py-3">
          <Skeleton className="h-[32px] w-[80px] rounded-full" />
          <Skeleton className="h-[32px] w-[92px] rounded-full" />
        </div>
      </div>
      <div className="overflow-hidden rounded-b-2xl border-x border-b border-ink/10 bg-white/60 shadow-soft mx-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-start gap-gap-sm border-b border-ink/5 px-6 py-4 last:border-b-0"
          >
            <Skeleton className="mt-[2px] size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-[14px] w-[55%]" />
              <Skeleton className="h-[12px] w-[85%]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
