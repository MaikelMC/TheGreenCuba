import { Skeleton } from "@/components/ui";

/**
 * Armazón de la ficha mientras el servidor resuelve el lugar en la base.
 *
 * Replica el orden del layout real —portada alta, título, subtítulo, chips,
 * bloque de información y botones— para que la llegada del contenido no
 * mueva nada. DESIGN.md: skeletons siempre que el layout es predecible,
 * nunca spinner solo.
 */
export default function PlaceLoading() {
  return (
    <div className="min-h-dvh bg-sand font-lv text-ink" aria-busy>
      <Skeleton className="h-[320px] w-full rounded-none" />
      <div className="mx-auto w-full max-w-xl px-5 py-5">
        <Skeleton className="h-[26px] w-[60%]" />
        <Skeleton className="mt-2 h-[14px] w-[40%]" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-[24px] w-[90px] rounded-full" />
          <Skeleton className="h-[24px] w-[110px] rounded-full" />
          <Skeleton className="h-[24px] w-[70px] rounded-full" />
        </div>
        <Skeleton className="mt-5 h-[64px] w-full rounded-2xl" />
        <div className="mt-5 space-y-[10px]">
          <Skeleton className="h-12 w-full rounded-full" />
          <div className="flex gap-[10px]">
            <Skeleton className="h-12 flex-1 rounded-full" />
            <Skeleton className="h-12 flex-1 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
