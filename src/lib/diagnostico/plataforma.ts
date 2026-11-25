/**
 * Clasificación de plataformas sin guardar el user agent completo.
 *
 * Las familias son deliberadamente pocas y suman siempre: Android, iOS,
 * escritorio y otros. Los bots se marcan aparte para excluirlos de las sesiones.
 */

export const PLATAFORMAS = ["android", "ios", "escritorio", "otros"] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];

export const ETIQUETA_PLATAFORMA: Record<Plataforma, string> = {
  android: "Android",
  ios: "iOS",
  escritorio: "Escritorio",
  otros: "Otros",
};

export interface EntornoPlataforma {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}

export interface PlataformaDetectada {
  plataforma: Plataforma;
  detalle: string;
  bot: boolean;
}

const BOT =
  /bot|crawler|spider|crawling|googlebot|bingbot|facebookexternalhit|slurp|duckduckbot|baiduspider|yandex|semrush|ahrefs|headlesschrome|lighthouse|pingdom|uptime/i;

/** Familia de navegador, sin versión completa ni user agent. */
export function navegadorFamilia(userAgent: string): string {
  if (/Edg\//i.test(userAgent)) return "Edge";
  if (/OPR\/|Opera/i.test(userAgent)) return "Opera";
  if (/SamsungBrowser/i.test(userAgent)) return "Samsung Internet";
  if (/Chrome\/|CriOS/i.test(userAgent)) return "Chrome";
  if (/Firefox\/|FxiOS/i.test(userAgent)) return "Firefox";
  if (/Safari\//i.test(userAgent)) return "Safari";
  return "Otro";
}

/** Versión mayor del navegador, sin el resto del user agent. */
export function navegadorVersion(userAgent: string): number | null {
  const patrones = [
    /Edg\/(\d+)/i,
    /OPR\/(\d+)/i,
    /SamsungBrowser\/(\d+)/i,
    /Chrome\/(\d+)/i,
    /CriOS\/(\d+)/i,
    /Firefox\/(\d+)/i,
    /FxiOS\/(\d+)/i,
    /Version\/(\d+).*Safari/i,
  ];
  for (const patron of patrones) {
    const version = patron.exec(userAgent)?.[1];
    if (version) return Number(version);
  }
  return null;
}

/**
 * Detecta la plataforma. iPadOS 13+ se presenta como Mac: se reconoce por
 * `maxTouchPoints`. Los bots no cuentan como sesiones y van a `otros`.
 */
export function detectarPlataforma(entorno: EntornoPlataforma): PlataformaDetectada {
  const ua = entorno.userAgent || "";
  const platform = entorno.platform || "";
  const maxTouchPoints = entorno.maxTouchPoints ?? 0;

  if (BOT.test(ua)) {
    return { plataforma: "otros", detalle: "Bot", bot: true };
  }

  if (/Android/i.test(ua)) {
    const tablet = !/Mobile/i.test(ua);
    return {
      plataforma: "android",
      detalle: tablet ? "Tablet Android" : "Android",
      bot: false,
    };
  }

  if (/iPhone|iPod/i.test(ua)) {
    return { plataforma: "ios", detalle: "iPhone", bot: false };
  }

  if (/iPad/i.test(ua)) {
    return { plataforma: "ios", detalle: "iPad", bot: false };
  }

  if (/Macintosh|Mac OS X/i.test(ua) && maxTouchPoints > 1) {
    return { plataforma: "ios", detalle: "iPadOS", bot: false };
  }

  if (/HarmonyOS/i.test(ua)) {
    return { plataforma: "otros", detalle: "HarmonyOS", bot: false };
  }

  if (/KaiOS/i.test(ua)) {
    return { plataforma: "otros", detalle: "KaiOS", bot: false };
  }

  if (/Windows/i.test(ua)) {
    return { plataforma: "escritorio", detalle: "Windows", bot: false };
  }
  if (/CrOS/i.test(ua)) {
    return { plataforma: "escritorio", detalle: "ChromeOS", bot: false };
  }
  if (/Macintosh|Mac OS X/i.test(ua)) {
    return { plataforma: "escritorio", detalle: "macOS", bot: false };
  }
  if (/Linux|X11/i.test(ua) || /Linux/i.test(platform)) {
    return { plataforma: "escritorio", detalle: "Linux", bot: false };
  }

  return { plataforma: "otros", detalle: "Sin clasificar", bot: false };
}

/** Normaliza un valor ya guardado, incluidas filas antiguas. */
export function normalizarPlataforma(valor: unknown): Plataforma {
  return valor === "android" || valor === "ios" || valor === "escritorio"
    ? valor
    : "otros";
}
