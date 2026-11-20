import type { Metadata } from "next";
import { getAppUser } from "@/lib/auth/user";
import { PruebaOnboarding } from "@/components/admin/prueba-onboarding";

export const metadata: Metadata = {
  title: "Prueba del onboarding",
  robots: { index: false, follow: false },
};

/**
 * Herramienta temporal para recorrer el onboarding cuantas veces haga falta
 * mientras se optimiza el flujo de registro de usuarios y negocios.
 *
 * Vive bajo `/admin`, así que hereda su puerta —solo un administrador entra— y
 * su armazón, y no se enlaza desde el menú: se abre por URL. Cuando acabe la
 * ronda de pruebas se borran esta carpeta, la ruta de API
 * (`/api/admin/prueba-onboarding`) y el componente `PruebaOnboarding`.
 *
 * No lleva `dynamic = "force-dynamic"` propio: el layout de `/admin` ya lo
 * declara y la configuración de segmento se hereda.
 */
export default async function PruebaOnboardingPage() {
  const user = await getAppUser();

  return (
    <div className="max-w-2xl">
      <h1 className="font-lv-display text-h3 font-bold text-ink">
        Prueba del onboarding
      </h1>
      <p className="text-small text-ink-soft/75 mt-1">
        Temporal · solo administración · se retira al terminar las pruebas
      </p>

      <div className="mt-gap-md bg-white border border-ink/5 rounded-2xl p-gap-md">
        <p className="text-small text-ink-soft/75">
          El botón deja tu cuenta como recién creada —onboarding pendiente, sin
          ciudad ni preferencias— y borra las de este navegador. Es lo que hace
          falta para volver a ver el flujo desde la pantalla de bienvenida,
          incluida la elección entre usuario y negocio.
        </p>

        <p className="text-small text-ink mt-gap-sm">
          <span className="text-ink-soft/75">Estado actual: </span>
          {user?.onboardingCompleted ? "completado" : "pendiente"}
          <span className="text-ink-soft/75"> · Ciudad: </span>
          {user?.locationCity || "sin definir"}
        </p>

        <PruebaOnboarding />
      </div>

      <p className="text-meta text-ink-soft/75 mt-gap-md">
        Dos efectos de probar el flujo con tu cuenta real: cada recorrido
        completo apunta un evento de onboarding terminado, y si registras un
        negocio de prueba queda como solicitud en{" "}
        <span className="text-ink">/admin/solicitudes</span>. «Ahora no» sale del
        asistente de negocio sin crear nada.
      </p>
    </div>
  );
}
