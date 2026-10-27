import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { TimerOff, UserX } from "lucide-react";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import {
  businessInvitations,
  businessOwners,
  places,
  users,
} from "@/lib/db/schema";
import { normalizarPermisos } from "@/lib/permisos-negocio";
import { generateId } from "@/lib/utils";
import { StateView } from "@/components/ui/state-view";

/* Lee la sesión y escribe en la base al aceptar: nunca se prerenderiza. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invitación al equipo",
  robots: { index: false, follow: false },
};

/**
 * El enlace que el dueño manda a un trabajador.
 *
 * Quien llega sin cuenta se va al alta con esta misma ruta como destino: tras
 * verificar el correo vuelve aquí y encuentra su sesión hecha. Con sesión, el
 * enlace se acepta en el acto —nace la fila de `business_owners` con los
 * permisos que el dueño marcó, la cuenta pasa a `owner` y el onboarding queda
 * completado— y se entra al panel sin pasar por el asistente.
 *
 * Escribir en un `GET` es aceptable aquí porque es idempotente: la invitación se
 * consume una vez y repetir la visita solo redirige al panel. El índice único
 * `(user_id, place_id)` y el `onConflictDoNothing` cubren dos pestañas a la vez.
 */
export default async function InvitacionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [invitacion] = await db
    .select({
      id: businessInvitations.id,
      placeId: businessInvitations.placeId,
      permissions: businessInvitations.permissions,
      expiresAt: businessInvitations.expiresAt,
      acceptedAt: businessInvitations.acceptedAt,
      acceptedBy: businessInvitations.acceptedBy,
      negocio: places.name,
    })
    .from(businessInvitations)
    .innerJoin(places, eq(places.id, businessInvitations.placeId))
    .where(eq(businessInvitations.token, token))
    .limit(1);

  if (!invitacion) return <Invalida />;

  /* Caducada se mira antes de pedir sesión: no tiene sentido mandar al alta a
     quien va a encontrarse esta misma pantalla después de registrarse. */
  if (invitacion.expiresAt.getTime() <= Date.now()) {
    return <Caducada negocio={invitacion.negocio} />;
  }

  const user = await getAppUser();
  if (!user) {
    redirect(`/register?next=${encodeURIComponent(`/invitacion/${token}`)}`);
  }

  if (invitacion.acceptedAt) {
    /* La misma persona volviendo a abrir su enlace —o una recarga— no puede
       quedarse en una pantalla de «ya usado»: ya está dentro. */
    if (invitacion.acceptedBy === user.id) redirect("/business");
    return <Usada negocio={invitacion.negocio} />;
  }

  const permisos = normalizarPermisos(invitacion.permissions);

  const [existente] = await db
    .select({ role: businessOwners.role, permissions: businessOwners.permissions })
    .from(businessOwners)
    .where(
      and(
        eq(businessOwners.userId, user.id),
        eq(businessOwners.placeId, invitacion.placeId),
      ),
    )
    .limit(1);

  /* Ya es el dueño: el enlace no tiene nada que darle. No se consume, porque
     probablemente lo reenvió y el destinatario sigue siendo otro. */
  if (existente?.role === "owner") redirect("/business");

  /* Se reclama **antes** de escribir el vínculo y con `accepted_at IS NULL` en
     el `where`: dos personas abriendo el mismo enlace a la vez no pueden acabar
     las dos dentro. La que pierde el reclamo ve el aviso de enlace usado. */
  const [reclamada] = await db
    .update(businessInvitations)
    .set({ acceptedAt: new Date(), acceptedBy: user.id })
    .where(
      and(
        eq(businessInvitations.id, invitacion.id),
        isNull(businessInvitations.acceptedAt),
      ),
    )
    .returning({ id: businessInvitations.id });

  if (!reclamada) {
    const [actual] = await db
      .select({ acceptedBy: businessInvitations.acceptedBy })
      .from(businessInvitations)
      .where(eq(businessInvitations.id, invitacion.id))
      .limit(1);
    if (actual?.acceptedBy === user.id) redirect("/business");
    return <Usada negocio={invitacion.negocio} />;
  }

  if (existente) {
    /* Ya estaba en el equipo: se suman los permisos del enlace en vez de
       reemplazarlos. Un enlace no puede quitarle acceso a quien ya lo tenía. */
    await db
      .update(businessOwners)
      .set({
        permissions: normalizarPermisos([
          ...(existente.permissions ?? []),
          ...permisos,
        ]),
      })
      .where(
        and(
          eq(businessOwners.userId, user.id),
          eq(businessOwners.placeId, invitacion.placeId),
        ),
      );
  } else {
    await db
      .insert(businessOwners)
      .values({
        id: generateId(),
        userId: user.id,
        placeId: invitacion.placeId,
        role: "editor",
        permissions: permisos,
        acceptedAt: new Date(),
      })
      .onConflictDoNothing();
  }

  await db
    .update(users)
    .set({
      /* `owner` es la capacidad de tener negocio, no la propiedad de este: el
         panel y `/api/me` la exigen para enseñarlo. Un administrador se queda
         como está. */
      ...(user.role === "user" ? { role: "owner" as const } : {}),
      /* El alta por invitación no pregunta gustos ni ciudad: el asistente no
         tiene nada que hacer aquí. */
      onboardingCompleted: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  redirect("/business");
}

function Invalida() {
  return (
    <Marco>
      <StateView
        variant="error"
        icon={UserX}
        title="Esta invitación no existe"
        description="Puede que el enlace esté mal copiado. Pídele al dueño del negocio uno nuevo."
        actions={<VolverAlInicio />}
      />
    </Marco>
  );
}

function Usada({ negocio }: { negocio: string }) {
  return (
    <Marco>
      <StateView
        variant="error"
        icon={UserX}
        title="Esta invitación ya se usó"
        description={`El enlace de ${negocio} ya tiene dueño. Si eres tú, entra a tu cuenta; si no, pide uno nuevo.`}
        actions={<VolverAlInicio />}
      />
    </Marco>
  );
}

function Caducada({ negocio }: { negocio: string }) {
  return (
    <Marco>
      <StateView
        variant="error"
        icon={TimerOff}
        title="Esta invitación caducó"
        description={`El enlace para entrar al equipo de ${negocio} ya no vale. Pídele al dueño que genere otro.`}
        actions={<VolverAlInicio />}
      />
    </Marco>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen min-h-dvh place-items-center bg-sand px-gutter py-gap-2xl font-lv text-ink">
      <div className="w-full max-w-[420px] rounded-4xl border border-ink/5 bg-white p-gap-lg shadow-soft">
        {children}
      </div>
    </main>
  );
}

function VolverAlInicio() {
  return (
    <Link
      href="/login"
      className="inline-flex h-11 items-center justify-center rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
    >
      Entrar a La Verde
    </Link>
  );
}
