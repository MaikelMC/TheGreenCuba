/**
 * Reglas del resumen de Diagnóstico. Un solo archivo para que los umbrales no
 * vivan repartidos entre la API y la interfaz.
 */

export const UMBRALES_DIAGNOSTICO = {
  sesionesParaExigirMapa: 50,
  androidSinWebgl: 0.05,
  cargasLentasOError: 0.1,
  swDesactualizado: 0.2,
} as const;

export interface EntradaResumen {
  sesiones: number;
  cargasMapa: number;
  android: number;
  androidSinWebgl: number;
  erroresAltos: number;
  cargasLentasOError: number;
  swRegistrado: number;
  swDesactualizado: number;
  sinClasificar: number;
}

export interface AvisoResumen {
  nivel: "grave" | "aviso";
  texto: string;
}

const pct = (parte: number, total: number) =>
  total > 0 ? Math.round((parte / total) * 1000) / 10 : 0;

/** Lista de problemas en lenguaje claro; vacía significa «todo correcto». */
export function evaluarResumen(entrada: EntradaResumen): AvisoResumen[] {
  const avisos: AvisoResumen[] = [];

  if (
    entrada.sesiones > UMBRALES_DIAGNOSTICO.sesionesParaExigirMapa &&
    entrada.cargasMapa === 0
  ) {
    avisos.push({
      nivel: "grave",
      texto: `El mapa no reporta ninguna carga con ${entrada.sesiones} sesiones. Revisa la telemetría del mapa.`,
    });
  }

  if (
    entrada.android > 0 &&
    entrada.androidSinWebgl / entrada.android > UMBRALES_DIAGNOSTICO.androidSinWebgl
  ) {
    avisos.push({
      nivel: "grave",
      texto: `${entrada.androidSinWebgl} de ${entrada.android} Android no tienen WebGL real (${pct(entrada.androidSinWebgl, entrada.android)} %).`,
    });
  }

  if (entrada.erroresAltos > 0) {
    avisos.push({
      nivel: "grave",
      texto: `${entrada.erroresAltos} ${entrada.erroresAltos === 1 ? "error de severidad alta" : "errores de severidad alta"} en los últimos 7 días.`,
    });
  }

  if (
    entrada.cargasMapa > 0 &&
    entrada.cargasLentasOError / entrada.cargasMapa >
      UMBRALES_DIAGNOSTICO.cargasLentasOError
  ) {
    avisos.push({
      nivel: "grave",
      texto: `${pct(entrada.cargasLentasOError, entrada.cargasMapa)} % de las cargas del mapa son lentas o fallan.`,
    });
  }

  if (entrada.sesiones > 0 && entrada.swRegistrado === 0) {
    avisos.push({
      nivel: "aviso",
      texto: "No se registra la versión del service worker de ninguna sesión.",
    });
  }

  if (
    entrada.swRegistrado > 0 &&
    entrada.swDesactualizado / entrada.swRegistrado >
      UMBRALES_DIAGNOSTICO.swDesactualizado
  ) {
    avisos.push({
      nivel: "aviso",
      texto: `${pct(entrada.swDesactualizado, entrada.swRegistrado)} % de las sesiones siguen en un service worker anterior al publicado.`,
    });
  }

  if (entrada.sinClasificar > 0) {
    avisos.push({
      nivel: "aviso",
      texto: `${entrada.sinClasificar} ${entrada.sinClasificar === 1 ? "sesión sin clasificar" : "sesiones sin clasificar"}: revisa plataformas desconocidas.`,
    });
  }

  return avisos;
}
