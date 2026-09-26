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
    <div className="h-dvh overflow-hidden bg-sand font-lv text-ink">
      {children}
    </div>
  );
}
