"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { mensajeDeRed } from "@/lib/errores-red";
import { pwaActiva } from "@/lib/pwa/flag";
import {
  altaPushDispositivo,
  clavePublicaVapid,
  estaInstalada,
  esIos,
  soportaPush,
} from "@/lib/pwa/push-client";
import { fetchMe } from "@/lib/session-client";

/**
 * El aviso de avisos push de la primera sesión.
 *
 * Se enseña **una vez por usuario y dispositivo** y después no vuelve a
 * molestar: el descarte queda en `localStorage` con la clave del usuario, así
 * que en un teléfono compartido el siguiente ve el suyo. Quien lo cierre puede
 * activarlo igual desde `/notifications`.
 *
 * El permiso del navegador **no se pide al cargar**: se pide al pulsar
 * «Activar avisos». Un `requestPermission()` sin gesto lo ignoran Chrome y
 * Safari, y en iOS lo dan por denegado. Este diálogo es la vía para que el gesto
 * exista sin obligar a buscar el interruptor.
 *
 * Solo aparece con onboarding hecho, sesión iniciada, PWA activa y sin
 * suscripción previa. En iPhone exige la app instalada: sin eso no hay
 * `pushManager`.
 */

function claveDe(userId: string): string {
  return `la-verde:push-prompt:${userId}`;
}

interface Sesion {
  authenticated?: boolean;
  user?: { id?: string; onboardingCompleted?: boolean } | null;
}

const ESPERA_SW_MS = 5000;

export function PushPrimer() {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* El id que se usa para recordar el descarte. */
  const usuario = useRef<string | null>(null);
  /* Ya se miró en esta carga: no repetir en cada navegación. */
  const revisado = useRef(false);

  useEffect(() => {
    if (revisado.current) return;
    if (!pwaActiva() || !soportaPush()) return;
    if (Notification.permission !== "default") return;
    if (!clavePublicaVapid()) return;
    /* En iPhone no hay push fuera de la app instalada: preguntar sería mentir. */
    if (esIos() && !estaInstalada()) return;

    let vivo = true;

    void (async () => {
      try {
        const data = await fetchMe<Sesion>();
        const id = data.user?.id;
        if (!vivo || !data.authenticated || !id) return;
        /* Durante el onboarding todavía no es «su» app: se espera a terminarlo.
           `pathname` vuelve a disparar esto al entrar al home. */
        if (!data.user?.onboardingCompleted) return;

        usuario.current = id;

        try {
          if (window.localStorage.getItem(claveDe(id)) === "1") {
            revisado.current = true;
            return;
          }
        } catch {
          // localStorage bloqueado: se pregunta igual, sin memoria del descarte.
        }

        /* `PwaRegister` registra el service worker al cargar. Sin él no hay a
           quién suscribir; se espera un poco y, si no aparece, no se pregunta. */
        const registro = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), ESPERA_SW_MS)),
        ]);
        if (!vivo || !registro) return;

        const suscripcion = await registro.pushManager.getSubscription();
        if (suscripcion) {
          recordar(id);
          revisado.current = true;
          return;
        }

        revisado.current = true;
        setAbierto(true);
      } catch {
        /* Sin sesión legible no se pregunta nada. */
      }
    })();

    return () => {
      vivo = false;
    };
  }, [pathname]);

  function recordar(id: string | null = usuario.current): void {
    if (!id) return;
    try {
      window.localStorage.setItem(claveDe(id), "1");
    } catch {
      // Sin localStorage el descarte dura lo que dure la pestaña.
    }
  }

  function cerrar(): void {
    setAbierto(false);
    setGuardando(false);
    setError(null);
    recordar();
  }

  async function activar(): Promise<void> {
    setError(null);
    setGuardando(true);

    try {
      const resultado = await altaPushDispositivo();

      /* Concedido, denegado o cancelado son decisiones del usuario: no se
         vuelve a preguntar. Un fallo de red o del servidor sí puede reintentarse
         en la próxima visita, así que el diálogo se queda abierto. */
      if (
        resultado.ok ||
        resultado.motivo === "denegado" ||
        resultado.motivo === "cancelado"
      ) {
        cerrar();
        return;
      }

      setError(
        resultado.mensaje ??
          "No se pudieron activar los avisos. Inténtalo otra vez.",
      );
    } catch (fallo) {
      setError(
        mensajeDeRed(fallo, "No se pudieron activar los avisos. Inténtalo otra vez."),
      );
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) return null;

  return (
    <Dialog
      open={abierto}
      onOpenChange={(open) => {
        if (!open) cerrar();
      }}
    >
      <DialogContent>
        <div className="flex items-start gap-gap-sm">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-verde-950 text-white">
            <Bell size={20} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle>Avisos en el móvil</DialogTitle>
            <DialogDescription className="mt-gap-xs">
              Te avisamos cuando un negocio que sigues publica algo nuevo o se
              añade un negocio en tu provincia. Puedes desactivarlos cuando
              quieras.
            </DialogDescription>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-gap-sm rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-[7px] text-meta font-medium text-destructive"
          >
            {error}
          </p>
        )}

        <div className="mt-gap-md flex flex-col-reverse gap-gap-xs sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={cerrar}
            className="inline-flex h-11 items-center justify-center rounded-full border border-ink/10 bg-white px-gap-md font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:text-verde-700"
          >
            Ahora no
          </button>
          <button
            type="button"
            onClick={() => void activar()}
            disabled={guardando}
            className="inline-flex h-11 items-center justify-center gap-gap-xs rounded-full bg-verde-950 px-gap-md font-lv-display text-small font-semibold text-white transition-colors duration-500 ease-outquint hover:bg-verde-800 disabled:cursor-wait disabled:opacity-60"
          >
            {guardando ? (
              <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
            ) : (
              <Bell size={16} strokeWidth={1.8} />
            )}
            Activar avisos
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
