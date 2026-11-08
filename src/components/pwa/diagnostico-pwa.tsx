"use client";

import { useEffect, useRef } from "react";

/**
 * Diagnóstico de cliente para detectar problemas del mapa en teléfonos reales.
 *
 * Se ejecuta una vez por sesión de navegador (marca en sessionStorage). No
 * duplica los errores JS que ya captura el script temprano del layout (detecta
 * window.__lvDiagActivo antes de registrar onerror).
 *
 * Exporta enviarEventoMapa() para que el componente del mapa lo llame directamente.
 */

const CLAVE_SESION = "lv_diag_enviado";
const CLAVE_COLA = "lv_diag_cola";
const MAX_COLA = 20;
const URL_ENDPOINT = "/api/diagnostico";

export type TipoDiagnostico =
  | "navegador"
  | "error"
  | "mapa_cargado"
  | "mapa_lento"
  | "mapa_error"
  | "mapa_abandonado";

export interface DatosMapa {
  msDesdePagina?: number;
  msDesdeMontaje?: number;
  msHastaIdle?: number;
  tesellasFallidas?: number;
}

/** Envía un evento de diagnóstico, con cola en localStorage si no hay red. */
export function enviarDiagnostico(
  tipo: TipoDiagnostico,
  datos: Record<string, unknown>,
): void {
  const id = `diag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const payload = { id, tipo, datos };

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    const enviado = navigator.sendBeacon(
      URL_ENDPOINT,
      JSON.stringify(payload),
    );
    if (enviado) return;
  }

  /* sendBeacon falló o no está: encolar y enviar con fetch en cuanto haya red. */
  encolarLocal(payload);
}

/** Versión con sendBeacon para usar en pagehide (no hay fetch disponible). */
function enviarConBeacon(payload: unknown): void {
  if (typeof navigator === "undefined" || !("sendBeacon" in navigator)) return;
  navigator.sendBeacon(URL_ENDPOINT, JSON.stringify(payload));
}

function encolarLocal(payload: unknown): void {
  try {
    const raw = localStorage.getItem(CLAVE_COLA);
    const cola: unknown[] = raw ? (JSON.parse(raw) as unknown[]) : [];
    cola.push(payload);
    /* Máximo 20: descarta los más antiguos. */
    if (cola.length > MAX_COLA) cola.splice(0, cola.length - MAX_COLA);
    localStorage.setItem(CLAVE_COLA, JSON.stringify(cola));
  } catch {
    // localStorage no disponible: se pierde el evento.
  }
}

async function vaciarCola(): Promise<void> {
  let cola: unknown[] = [];
  try {
    const raw = localStorage.getItem(CLAVE_COLA);
    if (!raw) return;
    cola = JSON.parse(raw) as unknown[];
    if (cola.length === 0) return;
    localStorage.removeItem(CLAVE_COLA);
  } catch {
    return;
  }

  for (const payload of cola) {
    try {
      await fetch(URL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      /* Sin red: vuelve a encolar. */
      encolarLocal(payload);
    }
  }
}

function detectarPlataforma(): "android" | "ios" | "escritorio" {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  return "escritorio";
}

function extraerVersionChrome(ua: string): string | null {
  const m = ua.match(/Chrome\/(\d+)/);
  return m?.[1] ?? null;
}

interface InfoWebgl {
  webgl1: boolean;
  webgl2: boolean;
  webglSoftware: boolean;
  gpu: string | null;
}

function probarWebgl(): InfoWebgl {
  const canvas = document.createElement("canvas");
  let webgl1 = false;
  let webgl2 = false;
  let webglSoftware = false;
  let gpu: string | null = null;

  try {
    const ctx = canvas.getContext("webgl") as WebGLRenderingContext | null;
    if (ctx) {
      webgl1 = true;
      const ext = ctx.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        gpu = ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
      }

      /* Detecta WebGL por software: crea un contexto con la restricción activada.
         Si falla, el hardware real no soporta WebGL sin el modo software. */
      const ctxDuro = canvas.getContext("webgl", {
        failIfMajorPerformanceCaveat: true,
      }) as WebGLRenderingContext | null;
        webglSoftware = !ctxDuro;
    }
  } catch {
    // WebGL bloqueado por política del dispositivo.
  }

  try {
    const ctx2 = canvas.getContext("webgl2");
    if (ctx2) webgl2 = true;
  } catch {
    // Sin WebGL2.
  }

  return { webgl1, webgl2, webglSoftware, gpu };
}

function recopilarDatosNavegador(): Record<string, unknown> {
  const ua = navigator.userAgent;
  const webgl = probarWebgl();
  const conn = (
    navigator as Navigator & {
      connection?: { effectiveType?: string };
    }
  ).connection;

  let swVersion: string | null = null;
  let swEsperando = false;
  try {
    // El SW expone SW_VERSION en sw-version.js; el PwaRegister guarda la versión.
    const v = (window as Window & { SW_VERSION?: string }).SW_VERSION;
    if (v) swVersion = v;
  } catch {
    // Sin acceso.
  }

  return {
    ua,
    plataforma: detectarPlataforma(),
    chromeVersion: extraerVersionChrome(ua),
    pwa: window.matchMedia("(display-mode: standalone)").matches,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    ...webgl,
    conexion: conn?.effectiveType ?? null,
    swVersion,
    swEsperando,
  };
}

/** Llama al componente del mapa para registrar tiempos y errores. */
export function crearVigilanteMapa(montadoEn: number): {
  registrarCargado: (datos: DatosMapa) => void;
  registrarError: (mensaje: string, detalles?: Record<string, unknown>) => void;
  registrarLento: () => void;
  destruir: () => void;
} {
  const inicioPagina = typeof performance !== "undefined" ? performance.now() : 0;
  let tesellasFallidas = 0;
  let destruido = false;

  /* Conteo de teselas fallidas durante los primeros 30 s. */
  const contarTesela = () => {
    tesellasFallidas++;
  };

  /* pagehide: si el usuario se va antes de que cargue el mapa. */
  const alSalir = () => {
    if (destruido) return;
    const msDesdePagina = typeof performance !== "undefined" ? performance.now() : 0;
    const msDesdeMontaje = Date.now() - montadoEn;
    enviarConBeacon({
      id: `diag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tipo: "mapa_abandonado",
      datos: { msDesdePagina, msDesdeMontaje, tesellasFallidas },
    });
  };
  window.addEventListener("pagehide", alSalir);

  const limpiarTeselas = setTimeout(() => {
    // Después de 30 s ya no contamos errores de teselas.
  }, 30_000);

  return {
    registrarCargado(datos: DatosMapa) {
      destruido = true;
      window.removeEventListener("pagehide", alSalir);
      clearTimeout(limpiarTeselas);
      enviarDiagnostico("mapa_cargado", {
        msDesdePagina: datos.msDesdePagina ?? inicioPagina,
        msDesdeMontaje: datos.msDesdeMontaje,
        msHastaIdle: datos.msHastaIdle,
        tesellasFallidas,
      });
    },
    registrarError(mensaje: string, detalles?: Record<string, unknown>) {
      enviarDiagnostico("mapa_error", { mensaje, ...detalles });
    },
    registrarLento() {
      enviarDiagnostico("mapa_lento", {
        msDesdeMontaje: Date.now() - montadoEn,
        tesellasFallidas,
      });
    },
    destruir() {
      destruido = true;
      window.removeEventListener("pagehide", alSalir);
      clearTimeout(limpiarTeselas);
    },
  };
}

export function DiagnosticoPwa() {
  const enviado = useRef(false);

  useEffect(() => {
    if (enviado.current) return;
    if (typeof window === "undefined") return;

    /* Una vez por sesión. */
    if (sessionStorage.getItem(CLAVE_SESION)) {
      /* Cola pendiente de red anterior. */
      void vaciarCola();
      return;
    }

    enviado.current = true;
    sessionStorage.setItem(CLAVE_SESION, "1");

    /* Vacía eventos pendientes de sesiones anteriores sin red. */
    void vaciarCola();

    const datos = recopilarDatosNavegador();
    enviarDiagnostico("navegador", datos);

    /* Al recuperar red: vaciar la cola local. */
    const alOnline = () => void vaciarCola();
    window.addEventListener("online", alOnline);
    return () => window.removeEventListener("online", alOnline);
  }, []);

  return null;
}
