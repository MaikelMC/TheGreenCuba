/**
 * Telemetría de cliente. Sin dependencias de React.
 *
 * Los eventos se encolan en `localStorage` y se envían con `fetch`. Al ocultar
 * la página se vuelca la cola con `sendBeacon`, que sí sobrevive al cierre.
 */

import {
  detectarPlataforma,
  navegadorFamilia,
  navegadorVersion,
} from "./plataforma";
import {
  aplicarAccionMapa,
  ESTADO_MAPA_INICIAL,
  type AccionMapa,
  type EstadoMapa,
} from "./mapa";
import type { MotivoMapa, TipoDiagnostico } from "./eventos";

const URL_ENDPOINT = "/api/diagnostico";
const CLAVE_SESION = "lv_diag_sesion";
const CLAVE_COLA = "lv_diag_cola";
const MAX_COLA = 20;

interface EventoPendiente {
  id: string;
  tipo: TipoDiagnostico;
  datos: Record<string, unknown>;
}

let vaciando = false;

function nuevoId(): string {
  return `diag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function sesionDiagnostico(): string {
  if (typeof window === "undefined") return "sin-sesion";
  try {
    const existente = sessionStorage.getItem(CLAVE_SESION);
    if (existente) return existente;
    const nueva = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(CLAVE_SESION, nueva);
    return nueva;
  } catch {
    return "sin-sesion";
  }
}

function leerCola(): EventoPendiente[] {
  try {
    const raw = localStorage.getItem(CLAVE_COLA);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as EventoPendiente[]) : [];
  } catch {
    return [];
  }
}

function escribirCola(cola: EventoPendiente[]): void {
  try {
    localStorage.setItem(CLAVE_COLA, JSON.stringify(cola.slice(-MAX_COLA)));
  } catch {
    /* Sin localStorage se pierde el evento; la app sigue. */
  }
}

function encolar(evento: EventoPendiente): void {
  const cola = leerCola();
  cola.push(evento);
  escribirCola(cola);
}

function datosConContexto(datos: Record<string, unknown>): Record<string, unknown> {
  return {
    ...datos,
    sesion: sesionDiagnostico(),
    ruta:
      typeof window !== "undefined"
        ? window.location.pathname.slice(0, 160)
        : "/",
  };
}

/** Registra un fallo de almacenamiento sin guardar el mensaje completo. */
export function registrarFalloAlmacen(
  nombre: string,
  operacion: string,
): void {
  enviarDiagnostico("error", {
    mensaje: `IndexedDB ${nombre}`,
    errorNombre: nombre,
    operacion,
  });
}

/** Encola y lanza el envío. Nunca lanza. */
export function enviarDiagnostico(
  tipo: TipoDiagnostico,
  datos: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  encolar({ id: nuevoId(), tipo, datos: datosConContexto(datos) });
  void vaciarCola();
}

/** Vuelca la cola con `sendBeacon`, para `pagehide` y `visibilitychange`. */
export function volcarColaConBeacon(): void {
  if (typeof navigator === "undefined" || !("sendBeacon" in navigator)) return;
  const cola = leerCola();
  if (cola.length === 0) return;
  const restantes: EventoPendiente[] = [];
  for (const evento of cola) {
    const enviado = navigator.sendBeacon(
      URL_ENDPOINT,
      JSON.stringify(evento),
    );
    if (!enviado) restantes.push(evento);
  }
  escribirCola(restantes);
}

/** Envía lo pendiente. Si falla la red, deja la cola intacta. */
export async function vaciarCola(): Promise<void> {
  if (vaciando || typeof window === "undefined") return;
  const cola = leerCola();
  if (cola.length === 0) return;
  vaciando = true;
  const enviados = new Set<string>();

  for (const evento of cola) {
    try {
      const res = await fetch(URL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(evento),
        keepalive: true,
      });
      if (res.ok) enviados.add(evento.id);
    } catch {
      /* Sin red: se conserva para la próxima vuelta. */
    }
  }

  /* Se relee la cola: mientras se enviaba pudieron entrar eventos nuevos. */
  escribirCola(leerCola().filter((evento) => !enviados.has(evento.id)));
  vaciando = false;
}

export interface SoporteWebgl {
  webgl1: boolean;
  webgl2: boolean;
  webglSoftware: boolean;
}

/**
 * Comprueba WebGL con canvases distintos. Reutilizar el canvas devolvía el
 * contexto anterior e ignoraba `failIfMajorPerformanceCaveat`, que es lo que
 * hacía que «WebGL por software» fuera siempre cero.
 */
export function detectarWebgl(): SoporteWebgl {
  if (typeof document === "undefined") {
    return { webgl1: false, webgl2: false, webglSoftware: false };
  }

  let webgl1 = false;
  let webgl2 = false;
  let webglSoftware = false;

  try {
    const canvas = document.createElement("canvas");
    webgl1 = Boolean(canvas.getContext("webgl"));
  } catch {
    webgl1 = false;
  }

  if (webgl1) {
    try {
      const canvasDuro = document.createElement("canvas");
      const duro = canvasDuro.getContext("webgl", {
        failIfMajorPerformanceCaveat: true,
      });
      webglSoftware = !duro;
    } catch {
      webglSoftware = false;
    }
  }

  try {
    const canvas2 = document.createElement("canvas");
    webgl2 = Boolean(canvas2.getContext("webgl2"));
  } catch {
    webgl2 = false;
  }

  return { webgl1, webgl2, webglSoftware };
}

async function versionPublicada(): Promise<string | null> {
  try {
    const res = await fetch(`/sw-version.js?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const texto = await res.text();
    return /"([^"]+)"/.exec(texto)?.[1] ?? null;
  } catch {
    return null;
  }
}

function versionActiva(): Promise<string | null> {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    !navigator.serviceWorker.controller
  ) {
    return Promise.resolve(null);
  }
  return new Promise((resolver) => {
    const canal = new MessageChannel();
    const tope = setTimeout(() => resolver(null), 1200);
    canal.port1.onmessage = (evento) => {
      clearTimeout(tope);
      resolver(typeof evento.data === "string" ? evento.data : null);
    };
    navigator.serviceWorker.controller?.postMessage(
      { type: "GET_VERSION" },
      [canal.port2],
    );
  });
}

/** Datos de una sesión, sin user agent completo ni identificadores personales. */
export async function recopilarDatosNavegador(): Promise<Record<string, unknown>> {
  const ua = navigator.userAgent;
  const plataforma = detectarPlataforma({
    userAgent: ua,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  });
  const webgl = detectarWebgl();
  const conn = (
    navigator as Navigator & { connection?: { effectiveType?: string } }
  ).connection;
  const [swVersion, swPublicada] = await Promise.all([
    versionActiva(),
    versionPublicada(),
  ]);

  return {
    plataforma: plataforma.plataforma,
    plataformaDetalle: plataforma.detalle,
    bot: plataforma.bot,
    navegador: navegadorFamilia(ua),
    navegadorVersion: navegadorVersion(ua),
    pwa:
      typeof window !== "undefined" &&
      window.matchMedia("(display-mode: standalone)").matches,
    deviceMemory:
      (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    ...webgl,
    conexion: conn?.effectiveType ?? null,
    swVersion,
    swPublicada,
  };
}

export interface VigilanteMapa {
  registrarCargado: (ms: number) => void;
  registrarError: (motivo: MotivoMapa) => void;
  registrarLento: (ms: number) => void;
  destruir: () => void;
}

/** Instrumenta una carga de mapa y emite cada evento una sola vez. */
export function crearVigilanteMapa(montadoEn: number): VigilanteMapa {
  let estado: EstadoMapa = ESTADO_MAPA_INICIAL;

  const emitir = (accion: AccionMapa) => {
    const resultado = aplicarAccionMapa(estado, accion);
    estado = resultado.estado;
    for (const evento of resultado.eventos) {
      const ms = Date.now() - montadoEn;
      enviarDiagnostico(evento.tipo, { ...evento.datos, msDesdeMontaje: ms });
    }
    return resultado;
  };

  emitir({ tipo: "inicio" });

  const alOcultar = () => {
    if (typeof document === "undefined") return;
    if (document.visibilityState !== "hidden") return;
    emitir({ tipo: "abandonado", ms: Date.now() - montadoEn });
    volcarColaConBeacon();
  };

  const alSalir = () => {
    emitir({ tipo: "abandonado", ms: Date.now() - montadoEn });
    volcarColaConBeacon();
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", alOcultar);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", alSalir);
  }

  const limpiar = () => {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", alOcultar);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", alSalir);
    }
  };

  return {
    registrarCargado(ms: number) {
      emitir({ tipo: "cargado", ms });
      limpiar();
    },
    registrarError(motivo: MotivoMapa) {
      emitir({ tipo: "error", motivo });
      limpiar();
    },
    registrarLento(ms: number) {
      emitir({ tipo: "lento", ms });
    },
    destruir() {
      limpiar();
    },
  };
}
