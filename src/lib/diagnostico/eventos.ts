/** Nombres únicos de la telemetría. Cliente y consulta usan esta lista. */
export const TIPOS_DIAGNOSTICO = [
  "navegador",
  "error",
  "mapa_inicio",
  "mapa_cargado",
  "mapa_lento",
  "mapa_error",
  "mapa_abandonado",
] as const;

export type TipoDiagnostico = (typeof TIPOS_DIAGNOSTICO)[number];

/** Motivos cortos de un fallo de mapa. Nunca se guarda el mensaje completo. */
export const MOTIVOS_MAPA = [
  "sin_webgl",
  "teselas",
  "estilo",
  "red",
  "desconocido",
] as const;

export type MotivoMapa = (typeof MOTIVOS_MAPA)[number];

export function esTipoDiagnostico(valor: string): valor is TipoDiagnostico {
  return (TIPOS_DIAGNOSTICO as readonly string[]).includes(valor);
}

/** Clasifica el error de MapLibre sin guardar detalles del dispositivo. */
export function motivoMapa(mensaje: string): MotivoMapa {
  const texto = mensaje.toLowerCase();
  if (texto.includes("webgl")) return "sin_webgl";
  if (texto.includes("tile") || texto.includes("tesel")) return "teselas";
  if (texto.includes("style") || texto.includes("estilo")) return "estilo";
  if (
    texto.includes("network") ||
    texto.includes("fetch") ||
    texto.includes("failed") ||
    texto.includes("timeout")
  ) {
    return "red";
  }
  return "desconocido";
}
