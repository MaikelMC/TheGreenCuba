import { type ReactNode } from "react";
import Link from "next/link";
import { Clock, MapPin, Wallet } from "lucide-react";
import { Logo } from "@/components/layout/logo";

/* Mismas tres promesas que la sección de cierre de la landing, en el mismo
   orden. No son adorno: son lo que distingue a La Verde de una lista de
   sitios. */
const PILLARS = [
  {
    icon: Wallet,
    title: "Con las monedas que aceptan",
    text: "CUP, USD, EUR o transferencia. Filtra por lo que llevas encima.",
  },
  {
    icon: Clock,
    title: "Abierto a la hora que buscas",
    text: "Horarios reales, no los que alguien escribió una vez y no volvió a tocar.",
  },
  {
    icon: MapPin,
    title: "Cerca de donde estás",
    text: "Santiago de Cuba primero, barrio por barrio.",
  },
];

/**
 * Dos composiciones, no una que se encoge.
 *
 * En escritorio la pantalla se parte: el cielo del hero a la izquierda —donde
 * caben la marca, la promesa y las tres razones— y el formulario a la derecha.
 * Antes esto era una tarjeta blanca centrada sobre arena, que no se parecía a
 * nada de lo que hay al otro lado del clic; la landing es oscura, con degradado
 * y grano, y la puerta de entrada tiene que serlo también.
 *
 * En móvil esa misma división no funciona: sin ancho para las dos mitades, el
 * corte se lee como dos bloques apilados que no tienen que ver entre sí. Así
 * que el cielo se estira bajo toda la pantalla y el formulario flota encima,
 * sobre una sola superficie.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lv-grain relative min-h-screen min-h-dvh bg-sand font-lv text-ink lg:grid lg:h-dvh lg:min-h-0 lg:grid-cols-[1.05fr_1fr] lg:overflow-hidden">
      {/* El cielo de móvil, aparte del panel de escritorio: uno se pinta detrás
          de todo y el otro es una columna. Comparten la clase, no la caja. */}
      <div
        aria-hidden
        className="auth-mobile-glow lv-grid-glow pointer-events-none absolute inset-0 lg:hidden"
      />

      {/* Todo lo de dentro es de escritorio: por debajo de `lg` esta columna no
          se pinta, así que no hacen falta prefijos. Si vuelve a haber una
          versión móvil de este panel, se añaden aquí. */}
      <aside className="auth-brand-panel lv-grid-glow relative hidden flex-col gap-gap-lg overflow-hidden px-gap-3xl py-gap-3xl lg:flex lg:justify-between">
        {/* Halo de marca: el mismo par de radiales del hero, aquí para que el
            borde inferior del panel no corte en seco. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-24 size-[420px] rounded-full bg-verde-500/20 blur-[120px]"
        />

        <Link
          href="/"
          className="relative inline-flex items-center gap-gap-md self-start transition-opacity duration-500 ease-outquint hover:opacity-80"
        >
          {/* El halo va en su propia caja y no en el enlace entero: pegado al
              enlace, el resplandor saldría también por detrás del nombre y
              convertiría las letras en una mancha verde. */}
          <span className="relative inline-flex shrink-0">
            <span
              aria-hidden
              className="logo-breath absolute -inset-4 rounded-full bg-verde-400/25 blur-xl"
            />
            <Logo className="logo-float relative h-12 w-auto" />
          </span>
          <span className="font-lv-display text-[26px] font-bold tracking-[-0.02em] text-white">
            La Verde
          </span>
        </Link>

        <div className="relative mt-4 flex flex-col gap-gap-md">
          <p className="inline-flex self-start items-center rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-200 backdrop-blur-sm">
            Descubrimiento de lugares
          </p>

          {/* Una sola frase con degradado por sección, como manda el sistema.
              Va como `<p>` y no como titular: es reclamo de marca, y el único
              encabezado de la pantalla tiene que ser el del formulario, que es
              lo que la persona ha venido a hacer. */}
          <p className="font-lv-display text-[38px] font-bold leading-[1.15] tracking-normal text-white text-balance">
            Escribe lo que buscas.{" "}
            <span className="bg-gradient-to-r from-verde-200 via-verde-300 to-emerald-400 bg-clip-text text-transparent">
              La Verde te lleva.
            </span>
          </p>

          <ul className="flex flex-col gap-gap-md pt-gap-xs">
            {PILLARS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-gap-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-verde-300 backdrop-blur-sm">
                  <Icon size={16} strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block font-lv-display text-small font-semibold text-white">
                    {title}
                  </span>
                  <span className="block text-meta text-white/70 text-pretty">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative font-lv-display text-[10px] uppercase tracking-[0.22em] text-white/35">
          Santiago de Cuba · Cuba
        </p>
      </aside>

      <main className="auth-form-scroll relative flex min-h-screen min-h-dvh items-center justify-center px-gutter py-gap-2xl lg:h-dvh lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:px-gap-xl">
        <div className="my-auto flex w-full max-w-[420px] flex-col gap-gap-lg lg:my-auto">
          {/* La marca corona la tarjeta, sobre el cielo. Solo en móvil: en
              escritorio ya está arriba de la columna oscura y repetirla aquí
              sería decir dos veces lo mismo. */}
          <Link
            href="/"
            className="inline-flex items-center gap-gap-sm self-center transition-opacity duration-500 ease-outquint hover:opacity-80 lg:hidden"
          >
            <span className="relative inline-flex shrink-0">
              <span
                aria-hidden
                className="logo-breath absolute -inset-3 rounded-full bg-verde-400/25 blur-lg"
              />
              <Logo className="logo-float relative h-9 w-auto" />
            </span>
            <span className="font-lv-display text-[22px] font-bold tracking-[-0.02em] text-white">
              La Verde
            </span>
          </Link>

          {children}
        </div>
      </main>
    </div>
  );
}
