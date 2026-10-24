"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2, Smartphone } from "lucide-react";

import { mensajeDeRed } from "@/lib/errores-red";
import { pwaActiva } from "@/lib/pwa/flag";

/**
 * Alta y baja de los avisos push del navegador.
 *
 * Tres reglas que valen más que el código:
 *  - El permiso se pide **solo** al pulsar el botón. Un diálogo de permisos al
 *    cargar la página es la forma más rápida de que lo denieguen para siempre.
 *  - Si el permiso ya está denegado no se puede volver a preguntar desde aquí:
 *    el navegador lo ignora. Se explica cómo reactivarlo en los ajustes.
 *  - En iPhone/iPad el push solo existe con la app instalada en la pantalla de
 *    inicio (iOS 16.4+). Sin instalar, `pushManager` no está ni definido.
 *
 * La suscripción se guarda en `/api/push/subscribe`; el service worker solo
 * recibe y muestra.
 */

type Estado =
  | "cargando"
  | "sin-pwa"
  | "sin-soporte"
  | "sin-instalar"
  | "sin-clave"
  | "inactivo"
  | "activo"
  | "denegado"
  | "guardando";

function esIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    /* iPadOS 13+ se presenta como Mac; se distingue por la pantalla táctil. */
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function estaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return standalone || iosStandalone === true;
}

/** La clave VAPID viaja en base64url; `pushManager` la quiere en bytes. */
function claveAVBytes(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalizado = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(normalizado);
  /* El buffer se crea explícito, no con `new Uint8Array(n)`: `applicationServerKey`
     exige un `ArrayBuffer` y no admite `SharedArrayBuffer` en el tipo. */
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i);
  }
  return bytes;
}

function soportaPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function PushToggle() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [aviso, setAviso] = useState<string | null>(null);
  const [clavePublica] = useState(() =>
    (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim(),
  );

  const refrescar = useCallback(async () => {
    if (!pwaActiva()) {
      setEstado("sin-pwa");
      return;
    }
    if (!soportaPush()) {
      setEstado(esIos() && !estaInstalada() ? "sin-instalar" : "sin-soporte");
      return;
    }
    if (esIos() && !estaInstalada()) {
      setEstado("sin-instalar");
      return;
    }
    if (Notification.permission === "denied") {
      setEstado("denegado");
      return;
    }
    if (!clavePublica) {
      setEstado("sin-clave");
      return;
    }

    const registro = await navigator.serviceWorker.getRegistration();
    if (!registro) {
      /* La bandera está activa pero el service worker aún no se ha registrado
         (o el navegador lo borró): se reintenta al volver a montar. */
      setEstado("sin-pwa");
      return;
    }

    const suscripcion = await registro.pushManager.getSubscription();
    setEstado(suscripcion ? "activo" : "inactivo");
  }, [clavePublica]);

  useEffect(() => {
    let vivo = true;
    refrescar().catch(() => {
      if (vivo) setEstado("sin-soporte");
    });
    return () => {
      vivo = false;
    };
  }, [refrescar]);

  /* El service worker avisa cuando el servicio push le cambia la suscripción
     por su cuenta. Si se renovó, se guarda la nueva; si no pudo, se pide al
     usuario que la reactive. */
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const alRecibir = (event: MessageEvent) => {
      const tipo = (event.data as { type?: unknown } | null)?.type;

      if (tipo === "PUSH_SUBSCRIPTION_CHANGED") {
        const datos = (event.data as { subscription?: PushSubscriptionJSON }).subscription;
        if (!datos?.endpoint) return;
        void fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...datos, userAgent: navigator.userAgent }),
        })
          .then((response) => {
            if (response.ok) setEstado("activo");
          })
          .catch(() => {
            // Sin red: el service worker ya tiene la suscripción nueva y la
            // próxima visita la volverá a registrar.
          });
      }

      if (tipo === "PUSH_SUBSCRIPTION_FAILED") {
        setEstado("inactivo");
        setAviso("Los avisos se desactivaron. Vuelve a activarlos para seguir recibiendo novedades.");
      }
    };

    navigator.serviceWorker.addEventListener("message", alRecibir);
    return () => navigator.serviceWorker.removeEventListener("message", alRecibir);
  }, []);

  async function activar() {
    setAviso(null);

    if (!soportaPush()) {
      setEstado(esIos() ? "sin-instalar" : "sin-soporte");
      return;
    }

    setEstado("guardando");

    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "denegado" : "inactivo");
        if (permiso === "default") {
          setAviso("No se concedió el permiso. Puedes activarlo cuando quieras.");
        }
        return;
      }

      const registro = await navigator.serviceWorker.getRegistration();
      if (!registro) {
        setEstado("sin-pwa");
        setAviso("El modo offline todavía no está listo. Recarga la página e inténtalo otra vez.");
        return;
      }

      const existente = await registro.pushManager.getSubscription();
      const suscripcion =
        existente ??
        (await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: claveAVBytes(clavePublica),
        }));

      const datos = suscripcion.toJSON();
      if (!datos.endpoint || !datos.keys?.p256dh || !datos.keys?.auth) {
        throw new Error("El navegador devolvió una suscripción incompleta.");
      }

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...datos, userAgent: navigator.userAgent }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setEstado("inactivo");
        setAviso(data?.error ?? "No se pudieron activar los avisos. Inténtalo otra vez.");
        return;
      }

      setEstado("activo");
    } catch (error) {
      setEstado("inactivo");
      setAviso(mensajeDeRed(error, "No se pudieron activar los avisos. Inténtalo otra vez."));
    }
  }

  async function desactivar() {
    setAviso(null);
    setEstado("guardando");

    let desuscrito = false;

    try {
      const registro = await navigator.serviceWorker.getRegistration();
      const suscripcion = await registro?.pushManager.getSubscription();
      const endpoint = suscripcion?.endpoint;

      /* Primero se da de baja en el navegador: si esto falla, no tiene sentido
         borrar la fila del servidor y quedarse con una suscripción viva que ya
         no se puede desactivar desde aquí. */
      if (suscripcion) {
        await suscripcion.unsubscribe();
        desuscrito = true;
      }

      if (endpoint) {
        const response = await fetch("/api/push/unsubscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
        if (!response.ok) {
          /* El navegador ya no recibirá nada; la fila sobrante se limpia sola
             cuando el servicio push devuelva 404/410. No se puede decir que
             sigue activo. */
          setEstado("inactivo");
          setAviso("Se desactivó en este dispositivo, pero no se pudo avisar al servidor.");
          return;
        }
      }

      setEstado("inactivo");
    } catch (error) {
      /* Si `unsubscribe()` falló, la suscripción sigue viva. Si ya se había
         dado de baja y falló el aviso al servidor, no. */
      setEstado(desuscrito ? "inactivo" : "activo");
      setAviso(mensajeDeRed(error, "No se pudieron desactivar los avisos. Inténtalo otra vez."));
    }
  }

  if (estado === "cargando") {
    return (
      <div className="mt-gap-lg rounded-2xl border border-ink/10 bg-white/70 px-4 py-4 shadow-soft">
        <div className="flex items-center gap-3">
          <Loader2 size={18} strokeWidth={1.8} className="animate-spin text-ink-soft/50" />
          <span className="text-meta text-ink-soft/70">Comprobando los avisos…</span>
        </div>
      </div>
    );
  }

  const explicacion: Record<Estado, string> = {
    cargando: "",
    "sin-pwa": "Los avisos push se activan en la versión instalable de la app.",
    "sin-soporte": "Este navegador no admite notificaciones push.",
    "sin-instalar":
      "En iPhone y iPad los avisos solo funcionan con La Verde añadida a la pantalla de inicio: Compartir → Añadir a pantalla de inicio.",
    "sin-clave": "Los avisos push no están configurados en este entorno.",
    inactivo: "Recibe en este dispositivo los avisos de tus negocios y de La Verde.",
    activo: "Este dispositivo recibirá los avisos aunque la app esté cerrada.",
    denegado:
      "Bloqueaste las notificaciones para este sitio. Para activarlas, ábrelas en los ajustes del navegador y permite las notificaciones de La Verde.",
    guardando: "Un momento…",
  };

  const puedeActivar = estado === "inactivo";
  const puedeDesactivar = estado === "activo";
  const bloqueado = !puedeActivar && !puedeDesactivar;

  return (
    <div className="mt-gap-lg rounded-2xl border border-ink/10 bg-white/70 px-4 py-4 shadow-soft">
      <div className="flex items-start gap-3">
        <span
          className={`mt-[2px] grid size-10 shrink-0 place-items-center rounded-full border ${
            puedeDesactivar
              ? "border-verde-200 bg-verde-50 text-verde-600"
              : "border-ink/10 bg-sand text-ink-soft/60"
          }`}
        >
          {puedeDesactivar ? (
            <BellRing size={18} strokeWidth={1.8} />
          ) : bloqueado && estado !== "guardando" ? (
            <BellOff size={18} strokeWidth={1.8} />
          ) : (
            <Bell size={18} strokeWidth={1.8} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-lv-display text-small font-semibold text-ink">
              Avisos en este dispositivo
            </h3>

            {puedeActivar && (
              <button
                type="button"
                onClick={() => void activar()}
                className="inline-flex h-9 shrink-0 items-center gap-[6px] rounded-full bg-verde-950 px-4 font-lv-display text-meta font-semibold text-white transition-colors duration-500 ease-outquint hover:bg-verde-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
              >
                <Bell size={14} strokeWidth={1.8} />
                Activar
              </button>
            )}

            {puedeDesactivar && (
              <button
                type="button"
                onClick={() => void desactivar()}
                className="inline-flex h-9 shrink-0 items-center gap-[6px] rounded-full border border-ink/10 bg-white px-4 font-lv-display text-meta font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:text-verde-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
              >
                <BellOff size={14} strokeWidth={1.8} />
                Desactivar
              </button>
            )}

            {estado === "guardando" && (
              <span className="inline-flex h-9 items-center gap-[6px] text-meta text-ink-soft/60">
                <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
                Guardando
              </span>
            )}
          </div>

          <p className="mt-[6px] text-meta leading-relaxed text-ink-soft/75">
            {explicacion[estado]}
          </p>

          {estado === "sin-instalar" && (
            <p className="mt-2 inline-flex items-center gap-[6px] text-[11px] font-semibold uppercase tracking-[0.12em] text-verde-600">
              <Smartphone size={13} strokeWidth={1.8} />
              Requiere instalarla primero
            </p>
          )}

          {aviso && (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-[7px] text-meta font-medium text-destructive"
            >
              {aviso}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
