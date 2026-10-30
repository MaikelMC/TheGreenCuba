import type { Metadata } from "next";

/* El onboarding recoge las preferencias personales del visitante (ciudad,
   intereses, monedas): es exactamente el contenido que la guía del sitio
   manda mantener fuera del índice. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /* El alto descuenta `--kb-inset`, que escribe `page.tsx` desde
       `visualViewport` mientras hay un campo enfocado. En iOS Safari el teclado
       no encoge el layout: sin esto el pie con «Continuar» quedaba debajo y no
       había forma de llegar a él sin cerrar el teclado. Sin teclado vale 0 y el
       alto es `100dvh`, igual que antes. */
    <div
      className="overflow-hidden bg-sand font-lv text-ink"
      style={{ height: "calc(100dvh - var(--kb-inset, 0px))" }}
    >
      {children}
    </div>
  );
}
