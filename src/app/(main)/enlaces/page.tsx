import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, Link2 } from "lucide-react";
import { getAppUser } from "@/lib/auth/user";
import { siteConfig } from "@/config/site";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { REFERRAL_PARAM } from "@/lib/referral";
import { UserMenu } from "@/components/layout/user-menu";
import { CopyLink } from "@/components/profile/copy-link";

/* El segmento se declara dinámico de entrada, antes de que nadie lo pida: esta
   página lee la sesión, y sin la marca `next build` intenta prerenderizarla y
   se sale del paso estático de mala manera. Mismo motivo y mismo remedio que
   `(main)/business/layout.tsx`. */
export const dynamic = "force-dynamic";

/**
 * La sección del programa de afiliados.
 *
 * Se entra con la sesión puesta —lo garantiza el proxy, que tiene `/enlaces`
 * entre las rutas cerradas— pero **eso no basta**: ser afiliado es un permiso
 * suelto que concede un administrador a mano, así que aquí se comprueba el
 * código. Sin él no hay enlace que enseñar y la página rebota al perfil, que es
 * donde vive todo lo demás. El menú ya esconde la entrada, así que llegar hasta
 * aquí sin código es teclear la dirección.
 *
 * El enlace se arma con `siteConfig.url` y no con `window.location.origin`: así
 * es el dominio de producción aunque el afiliado entre por localhost, y el
 * enlace que copia es el que de verdad funciona cuando lo manda.
 */
export default async function LinksPage() {
  const user = await getAppUser();
  if (!user) redirect("/login?next=/enlaces");
  if (!user.referralCode) redirect("/profile");

  const referred = await db
    .select({ id: users.id, email: users.email, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.referredBy, user.id))
    .orderBy(desc(users.createdAt));

  const url = `${siteConfig.url.replace(/\/+$/, "")}/register?${REFERRAL_PARAM}=${user.referralCode}`;

  return (
    <div className="min-h-dvh bg-sand font-lv text-ink">
      <header className="sticky top-0 z-50 flex h-header items-center gap-2 border-b border-ink/5 bg-sand-warm/90 px-3 backdrop-blur-[16px] sm:gap-gap-sm sm:px-gap-md">
        <Link
          href="/home"
          className="grid size-9 shrink-0 place-items-center rounded-full text-ink-soft/75 transition-colors duration-500 ease-outquint hover:bg-verde-50 hover:text-verde-600"
          aria-label="Volver al inicio"
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
        </Link>
        <h1 className="truncate font-lv-display text-[18px] font-bold tracking-[-0.02em] text-ink">
          Enlaces
        </h1>
        <div className="min-w-0 flex-1" />
        <UserMenu initial={user.name.charAt(0)} avatarUrl={user.imageUrl ?? undefined} />
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-col gap-gap-lg px-gap-sm pt-gap-lg pb-gap-xl sm:px-gap-md">
        <section className="flex flex-col gap-gap-sm">
          <header className="flex flex-col gap-gap-2xs">
            <span className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600">
              Programa de afiliados
            </span>
            <h2 className="font-lv-display text-h2 font-bold leading-tight tracking-[-0.02em] text-ink">
              Tu enlace
            </h2>
            <p className="text-small text-ink-soft/75 text-pretty">
              Quien se registre entrando por aquí queda asociado a tu cuenta.
              Compártelo donde quieras.
            </p>
          </header>
          <CopyLink url={url} />
        </section>

        <section className="flex flex-col gap-gap-sm">
          <header className="flex items-baseline justify-between gap-gap-sm">
            <h2 className="font-lv-display text-[18px] font-bold tracking-[-0.02em] text-ink">
              Han entrado por tu enlace
            </h2>
            <span className="rounded-full border border-verde-200 bg-verde-50 px-3 py-1 font-lv-display text-meta font-semibold text-verde-700">
              {referred.length}
            </span>
          </header>

          {referred.length === 0 ? (
            <p className="rounded-2xl border border-ink/5 bg-white p-gap-md text-small text-ink-soft/75 shadow-soft">
              Todavía no ha entrado nadie. El enlace tarda en moverse: mándalo a
              quien creas que le va a servir.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-soft">
              {referred.map((person) => (
                <li
                  key={person.id}
                  className="flex items-center gap-gap-sm border-b border-ink/5 p-gap-md last:border-none"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-verde-50 text-verde-700">
                    <Link2 size={16} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-small text-ink">
                    {person.email}
                  </span>
                  <time
                    dateTime={person.createdAt.toISOString()}
                    className="shrink-0 text-meta text-ink-soft/70"
                  >
                    {person.createdAt.toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
