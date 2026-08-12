import { Building2, Leaf, Sparkles, UserRound } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-verde-950 pb-10 pt-16 text-white/60">
      <div className="container">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2 text-white">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-verde-400 to-verde-600">
                <Leaf className="h-4 w-4 text-verde-950" strokeWidth={2.2} />
              </span>
              <span className="font-display text-base font-bold">La Verde</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed">
              Te pasamos la verde: el lugar correcto cerca de ti, para compartir,
              visitar o comprar. Señalado por gente local, impulsado por IA.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Producto
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                ["El Mapa", "#mapa"],
                ["Búsqueda", "#busqueda"],
                ["Cómo funciona", "#como-funciona"],
                ["Por qué La Verde", "#diferente"]
              ].map(([label, href]) => (
                <li key={href}>
                  <a href={href} className="transition-colors hover:text-verde-300">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Creado por
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-verde-300" strokeWidth={2} />
                <span>
                  <span className="font-semibold text-white/80">Maikel de Armas Mourlot</span>
                  <br />
                  creador de La Verde
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-verde-300" strokeWidth={2} />
                <a
                  href="https://kynari.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-white/80 transition-colors hover:text-verde-200"
                >
                  Kynari
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-verde-300" strokeWidth={2} />
                Potencia tu vida con IA
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/35 sm:flex-row">
          <p>© {new Date().getFullYear()} La Verde. Pasándote la verde en Cuba.</p>
          <p className="text-center sm:text-right">
            Lanzamiento anticipado 2026 ·{" "}
            <a href="#waitlist" className="text-verde-300 hover:text-verde-200">
              ¿Te damos la verde?
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}