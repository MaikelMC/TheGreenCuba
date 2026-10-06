/**
 * Compartir la ficha pública de un lugar.
 *
 * Lo usan las superficies que tienen botón "Compartir": el overlay de detalle
 * del home, la ficha de `/place/[id]` y la tarjeta «Tu menú online» del panel
 * del negocio —esta última con `options`, porque lo que comparte el dueño es el
 * enlace de la carta y no el de la ficha—. Hasta ahora el de la ficha estaba
 * vacío —`onShare={() => {}}`—, así que este helper también le da destino al
 * botón.
 *
 * El enlace lleva UTM propio (`utm_source=share`): si quien lo recibe acaba
 * registrándose, el evento de alta conserva la atribución de que llegó por
 * una acción de compartir, no de una campaña (§28 del plan SEO/AEO).
 *
 * Nativo si el navegador lo tiene —móvil, que es donde vive este sitio— y
 * portapapeles en el resto, con aviso de que se copió.
 */

import { toast } from "sonner";
import { trackPlaceShared } from "@/lib/analytics";
import { trackPlaceMetric } from "@/lib/place-metrics";

export async function sharePlace(
  placeId: string,
  placeName: string,
  /**
   * Destino distinto de la ficha. Lo usa la carta: el enlace que comparte el
   * dueño desde su panel es el del menú, no el de la ficha, y el texto que
   * acompaña tiene que decir lo mismo que el enlace.
   */
  options?: { path?: string; campaign?: string; text?: string },
): Promise<void> {
  const path = options?.path ?? `/place/${placeId}`;
  const campaign = options?.campaign ?? "place_share";
  const url = `${window.location.origin}${path}?utm_source=share&utm_medium=referral&utm_campaign=${campaign}`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: placeName,
        text: options?.text ?? `Mira ${placeName} en La Verde`,
        url,
      });
      trackPlaceMetric(placeId, "share");
      trackPlaceShared(placeId, placeName, "native");
      return;
    }

    await navigator.clipboard.writeText(url);
    trackPlaceMetric(placeId, "share");
    trackPlaceShared(placeId, placeName, "clipboard");
    toast.success("Enlace copiado al portapapeles");
  } catch (error) {
    /* Cancelar la hoja nativa no es un fallo: no avisa y no registra. */
    if ((error as Error)?.name === "AbortError") return;
    toast.error("No se pudo compartir ahora mismo.");
  }
}
