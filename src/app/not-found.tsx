import type { Metadata } from "next";
import Link from "next/link";
import { Compass, House, MapPinOff } from "lucide-react";
import { StateView } from "@/components/ui";

export const metadata: Metadata = {
  title: "Página no encontrada",
};

/* Pastillas escritas enteras, no el `Button` primitivo: `twMerge` no conoce las
   claves propias del tema (`rounded-lv`, `font-lv-display`), así que el
   `className` de fuera no siempre gana sobre la base de `cva`. */
const PILL =
  "inline-flex items-center justify-center gap-gap-xs h-11 px-gap-lg rounded-full font-lv-display text-small font-semibold whitespace-nowrap transition-all duration-500 ease-outquint active:scale-[0.98]";
const PILL_PRIMARY = `${PILL} bg-verde-400 text-verde-950 shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)] hover:bg-verde-300`;
const PILL_OUTLINE = `${PILL} border border-ink/10 bg-white text-ink hover:border-verde-300 hover:bg-verde-50`;

export default function NotFound() {
  return (
    <div className="grid min-h-screen min-h-dvh place-items-center bg-sand font-lv text-ink px-gutter">
      <StateView
        icon={MapPinOff}
        title="No encontramos esta página"
        description="Puede que el enlace esté roto o que el lugar ya no exista. Vuelve al inicio para seguir explorando."
        actions={
          <>
            <Link href="/home" className={PILL_PRIMARY}>
              <Compass size={16} strokeWidth={1.8} />
              Explorar lugares
            </Link>
            <Link href="/" className={PILL_OUTLINE}>
              <House size={16} strokeWidth={1.8} />
              Ir a la portada
            </Link>
          </>
        }
      />
    </div>
  );
}
