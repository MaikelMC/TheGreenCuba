import { Building2, Sparkles, UserRound } from "lucide-react";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="bg-verde-950 pt-16 pb-10 text-[14px] text-white/70">
      <div className="mx-auto max-w-container px-5 md:px-8">
        <div className="flex flex-wrap justify-between items-start gap-gap-xl">
          <div className="max-w-[280px]">
            <div className="font-lv-display text-[18px] font-bold text-white flex items-center gap-gap-xs mb-gap-sm">
              <Logo className="h-[22px] w-auto shrink-0" />
              La Verde
            </div>
            <p className="text-[14px] leading-[1.6] text-white/70">
              La plataforma de descubrimiento de lugares en Cuba. Encuentra lo que buscas hablando como hablas.
            </p>
          </div>
          <div className="flex gap-gap-2xl flex-wrap">
            <div>
              <h4 className="font-lv-display text-[14px] font-semibold text-white mb-gap-sm">Producto</h4>
              <a href="#como-funciona" className="block text-[14px] text-white/70 py-[3px] transition-colors duration-500 hover:text-verde-300">Cómo funciona</a>
              <a href="#ejemplos" className="block text-[14px] text-white/70 py-[3px] transition-colors duration-500 hover:text-verde-300">Ejemplos</a>
              <a href="/business" className="block text-[14px] text-white/70 py-[3px] transition-colors duration-500 hover:text-verde-300">Para negocios</a>
            </div>
            <div>
              <h4 className="font-lv-display text-[14px] font-semibold text-white mb-gap-sm">Legal</h4>
              {/* Antes los dos apuntaban a `#`, o sea a ninguna parte. Ahora
                  llevan a la página de verdad, que es una sola con la
                  privacidad anclada dentro. */}
              <a href="/terminos#privacidad" className="block text-[14px] text-white/70 py-[3px] transition-colors duration-500 hover:text-verde-300">Privacidad</a>
              <a href="/terminos" className="block text-[14px] text-white/70 py-[3px] transition-colors duration-500 hover:text-verde-300">Términos</a>
            </div>
            {/* Bloque «Creado por» del sitio de La Verde. */}
            <div>
              <h4 className="font-lv-display text-[14px] font-semibold text-white mb-gap-sm">Creado por</h4>
              <ul className="space-y-2 text-[14px] text-white/70">
                <li className="flex items-start gap-2">
                  <UserRound size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-verde-300" aria-hidden />
                  <span>
                    <span className="font-semibold text-white">Maikel de Armas Mourlot</span>
                    <br />
                    creador de La Verde
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Building2 size={14} strokeWidth={2} className="shrink-0 text-verde-300" aria-hidden />
                  <a
                    href="https://kynari.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-white transition-colors duration-500 hover:text-verde-200"
                  >
                    Kynari
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles size={14} strokeWidth={2} className="shrink-0 text-verde-300" aria-hidden />
                  Potencia tu vida con IA
                </li>
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-gap-2xl border-t border-white/10 pt-gap-lg text-[13px]">
          &copy; 2026 La Verde. Hecho en Cuba.
        </p>
      </div>
    </footer>
  );
}
