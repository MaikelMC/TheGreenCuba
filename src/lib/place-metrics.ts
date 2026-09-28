/**
 * Registro de métricas desde el cliente.
 *
 * Fire-and-forget: no espera respuesta, no avisa si falla. La métrica es un
 * accesorio del gesto, no el objetivo del usuario — si la petición se corta,
 * lo que no puede hacer es estorbar el clic que la originó.
 *
 * Un solo punto (`src/lib/analytics.ts` ya emite los mismos gestos a PostHog):
 * aquí queda la copia que alimenta el ranking interno del panel, que la app
 * puede leer de su propia base sin llamar a servicios externos.
 */

export type MetricKind = "view" | "map_click" | "route" | "ai_match" | "save" | "share";

export function trackPlaceMetric(placeId: string, kind: MetricKind): void {
  if (typeof window === "undefined") return;
  void fetch("/api/metrics/place", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeId, kind }),
    keepalive: true,
  }).catch(() => {});
}
