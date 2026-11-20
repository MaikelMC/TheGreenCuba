import { type ReactNode } from "react";

/**
 * Carcasa de doble bisel del design system de La Verde: un contenedor exterior
 * con hairline y 6 px de padding, y dentro la superficie real con el radio
 * reducido en esos mismos 6 px. El radio interior siempre es el exterior menos
 * el padding; si se separan, la curva se abre en las esquinas.
 *
 * En móvil no hay bisel: la carcasa ocupa la pantalla entera y las esquinas
 * redondeadas quedarían recortando contra el fondo. Ahí solo va el núcleo.
 */
export function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex h-full max-w-[480px] flex-col sm:my-6 sm:h-[calc(100%-48px)] sm:rounded-4xl sm:bg-ink/5 sm:p-1.5 sm:ring-1 sm:ring-ink/5">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-sand-warm font-lv text-ink sm:rounded-[calc(2rem-6px)] sm:shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]">
        {children}
      </div>
    </div>
  );
}
