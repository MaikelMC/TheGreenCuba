import type { AnalyticsEventType } from "@/lib/analytics/events";

/**
 * Eventos desde el navegador.
 *
 * Solo para gestos que **solo** existen en el cliente y no pasan por ninguna
 * ruta propia: clics en los contactos de una ficha, el primer paso del alta de
 * negocio. Todo lo que el servidor puede deducir ya se registra allí y no se
 * manda desde aquí (`§8`, `§43`: nada de duplicar).
 *
 * Fire-and-forget, como `trackPlaceMetric`: no se espera, no se avisa si falla.
 * Si la petición se corta, lo que no puede hacer es estorbar el clic.
 */
export function trackClientEvent(
  type: AnalyticsEventType,
  props?: { businessId?: string; metadata?: Record<string, string> },
): void {
  if (typeof window === "undefined") return;
  void fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      businessId: props?.businessId,
      metadata: props?.metadata,
    }),
    keepalive: true,
  }).catch(() => {});
}
