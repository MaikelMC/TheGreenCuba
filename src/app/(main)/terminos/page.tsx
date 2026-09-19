import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos y privacidad · La Verde",
  description:
    "Qué es La Verde, qué datos guarda, dónde los guarda y con quién se puede hablar.",
};

/* La dirección que ya usa el panel de negocio para soporte. */
const SUPPORT_EMAIL = "soporte@laverde.cu";

const H2 = "font-lv-display text-[18px] font-bold tracking-[-0.02em] text-ink";
const P = "text-small leading-[1.7] text-ink-soft";

/**
 * Términos y privacidad en una sola página.
 *
 * Van juntos y con la privacidad anclada (`#privacidad`) porque separarlos en
 * dos documentos para tres párrafos cada uno es ceremonia. El texto dice lo que
 * la app hace de verdad hoy, no lo que diría un contrato: los lugares son un
 * catálogo de prueba, las cuentas salen de la configuración del servidor y no
 * hay base de datos detrás. Unos términos que prometieran más que el código
 * serían papel mojado.
 */
export default function TerminosPage() {
  return (
    <div className="min-h-dvh bg-sand font-lv text-ink">
      <article className="mx-auto flex max-w-[68ch] flex-col gap-gap-xl px-gutter py-gap-2xl">
        <header className="flex flex-col gap-gap-xs">
          <span className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600">
            Legal
          </span>
          <h1 className="font-lv-display text-[32px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Términos y privacidad
          </h1>
          <p className="text-small text-pretty text-ink-soft/75">
            Última revisión: septiembre de 2026.
          </p>
        </header>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Qué es La Verde</h2>
          <p className={P}>
            La Verde es un buscador de lugares en Cuba. Escribes lo que buscas
            como lo dirías hablando y la app te devuelve sitios que encajan, con
            su horario, las monedas que aceptan y lo que tienen cerca.
          </p>
          <p className={P}>
            Está en construcción y eso importa para lo que sigue. El catálogo de
            lugares que ves hoy es un conjunto de prueba con negocios reales de
            Santiago de Cuba: sirve para probar el producto, no para planear una
            salida. Las cuentas de acceso son de demostración y no hay una base
            de datos detrás que las guarde.
          </p>
        </section>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Tu cuenta</h2>
          <p className={P}>
            Las cuentas de esta demo se definen en la configuración del servidor,
            no se registran en ningún sitio. Al entrar se te pone una cookie
            firmada que solo dice quién eres y con qué rol, y que caduca a los
            siete días. No se envía a terceros ni se usa para seguirte.
          </p>
          <p className={P}>
            Si borras tu cuenta desde el perfil, se vacían tus preferencias y tu
            actividad de ese navegador y se cierra la sesión. No hay nada más
            que borrar, y por eso el aviso lo dice antes de hacerlo.
          </p>
        </section>

        <section id="privacidad" className="flex scroll-mt-24 flex-col gap-gap-sm">
          <h2 className={H2}>Privacidad: qué se guarda y dónde</h2>
          <p className={P}>
            Casi todo se queda en tu navegador. Tus preferencias —nombre, correo,
            teléfono, zona, gustos y monedas— y tu actividad —qué lugares abres y
            cuáles guardas— viven en el almacenamiento local del dispositivo.
            Viajan contigo mientras uses el mismo navegador y desaparecen si
            borras los datos del sitio. Nosotros no los vemos.
          </p>
          <p className={P}>
            Lo único que sale del dispositivo es lo que escribes en el buscador,
            que se manda al proveedor de inteligencia artificial para que
            interprete la consulta y devuelva lugares. No se le adjunta tu
            identidad ni tu historial.
          </p>
          <p className={P}>
            Las métricas de «Mis lugares» son tuyas y de nadie más: miden lo que
            has abierto en ese navegador, no lo que hace el resto de la gente.
          </p>
        </section>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Uso razonable</h2>
          <p className={P}>
            No uses La Verde para publicar datos falsos de un negocio, para
            suplantar a otro ni para sacar el catálogo con medios automatizados.
            Si encuentras una ficha equivocada, escríbenos y se corrige.
          </p>
        </section>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Contacto</h2>
          <p className={P}>
            Para cualquier duda sobre estos términos, sobre privacidad o sobre
            una ficha concreta:{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-semibold text-verde-600 transition-colors duration-500 ease-outquint hover:text-verde-700"
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>

        <Link
          href="/home"
          className="inline-flex h-11 w-fit items-center justify-center rounded-full border border-ink/10 bg-white px-gap-lg font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50"
        >
          Volver a La Verde
        </Link>
      </article>
    </div>
  );
}
