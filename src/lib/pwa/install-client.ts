"use client";

import { useEffect, useState } from "react";
import { esIos, estaInstalada } from "@/lib/pwa/push-client";

/**
 * La instalación de la PWA, del lado del navegador.
 *
 * Chromium avisa con `beforeinstallprompt` cuando la app se puede instalar, y
 * ese evento **solo se puede usar una vez**: si dos componentes lo guardaran
 * por su cuenta, el primero que llamara a `prompt()` dejaría al otro con un
 * objeto muerto. Por eso el evento vive aquí, en un único sitio, y de aquí
 * beben el aviso de bienvenida y el botón del mapa.
 *
 * Safari no implementa el evento: en iPhone la única vía es «Compartir →
 * Añadir a pantalla de inicio», y eso lo explica cada pantalla a su manera.
 */

export type ResultadoInstalacion = "accepted" | "dismissed" | "no-disponible";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface EstadoInstalacion {
  /** El navegador ofreció el diálogo nativo y nadie lo ha usado todavía. */
  puede: boolean;
  /** Ya se está usando como app instalada. */
  instalada: boolean;
  /** iPhone/iPad, donde el diálogo nativo no existe. */
  ios: boolean;
}

let evento: BeforeInstallPromptEvent | null = null;
let escuchando = false;
const oyentes = new Set<() => void>();

function avisar(): void {
  for (const oyente of oyentes) oyente();
}

/**
 * Los dos eventos globales, una sola vez por página.
 *
 * Se enganchan al evaluar el módulo, no al montar un componente: así el aviso
 * no depende de que React ya haya hidratado cuando Chromium dispare el evento.
 */
function asegurarEscucha(): void {
  if (escuchando || typeof window === "undefined") return;
  escuchando = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    evento = event as BeforeInstallPromptEvent;
    avisar();
  });

  window.addEventListener("appinstalled", () => {
    evento = null;
    avisar();
  });
}

asegurarEscucha();

function leerEstado(): EstadoInstalacion {
  if (typeof window === "undefined") {
    return { puede: false, instalada: false, ios: false };
  }
  return { puede: Boolean(evento), instalada: estaInstalada(), ios: esIos() };
}

/** Abre el diálogo nativo. Solo tiene efecto una vez por evento. */
export async function instalarPwa(): Promise<ResultadoInstalacion> {
  const actual = evento;
  if (!actual) return "no-disponible";

  try {
    await actual.prompt();
    const eleccion = await actual.userChoice.catch(() => null);
    return eleccion?.outcome ?? "dismissed";
  } catch {
    /* El evento ya se había usado o la instalación no está disponible. */
    return "no-disponible";
  } finally {
    evento = null;
    avisar();
  }
}

/**
 * El estado de instalación, reactivo.
 *
 * Arranca en «nada» y se corrige en el efecto: en el servidor no hay `window`,
 * y pintar el botón ya en la hidratación daría un desajuste con el HTML.
 */
export function useInstalacionPwa(): EstadoInstalacion {
  const [estado, setEstado] = useState<EstadoInstalacion>({
    puede: false,
    instalada: false,
    ios: false,
  });

  useEffect(() => {
    asegurarEscucha();
    const sincronizar = () => setEstado(leerEstado());
    oyentes.add(sincronizar);
    /* Un evento que llegara entre el render y esto no se pierde. */
    sincronizar();
    return () => {
      oyentes.delete(sincronizar);
    };
  }, []);

  return estado;
}
