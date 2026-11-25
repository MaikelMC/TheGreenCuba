"use client";

import { useEffect, useRef } from "react";
import {
  enviarDiagnostico,
  recopilarDatosNavegador,
  sesionDiagnostico,
  vaciarCola,
} from "@/lib/diagnostico/telemetria";

export {
  crearVigilanteMapa,
  detectarWebgl,
  enviarDiagnostico,
  recopilarDatosNavegador,
  vaciarCola,
} from "@/lib/diagnostico/telemetria";
export type { VigilanteMapa } from "@/lib/diagnostico/telemetria";

const CLAVE_SESION = "lv_diag_enviado";

/**
 * Envía una sesión de navegador por apertura. Los errores tempranos los captura
 * el script del layout antes de que React monte; aquí no se duplican.
 */
export function DiagnosticoPwa() {
  const enviado = useRef(false);

  useEffect(() => {
    if (enviado.current || typeof window === "undefined") return;
    enviado.current = true;

    /* La sesión existe aunque no se envíe el evento de navegador dos veces. */
    sesionDiagnostico();

    if (!sessionStorage.getItem(CLAVE_SESION)) {
      try {
        sessionStorage.setItem(CLAVE_SESION, "1");
      } catch {
        /* Sin sessionStorage se envía igual; solo puede duplicarse. */
      }
      void recopilarDatosNavegador()
        .then((datos) => enviarDiagnostico("navegador", datos))
        .catch(() => {
          /* Sin datos de navegador no hay sesión que clasificar. */
        });
    }

    void vaciarCola();
    const alOnline = () => void vaciarCola();
    window.addEventListener("online", alOnline);
    return () => window.removeEventListener("online", alOnline);
  }, []);

  return null;
}
