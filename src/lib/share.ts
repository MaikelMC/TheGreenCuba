/**
 * Compartir la ficha pública de un lugar.
 *
 * Lo usan las dos superficies que tienen botón "Compartir": el overlay de
 * detalle del home y la ficha de `/place/[id]`. Hasta ahora el de la ficha
 * estaba vacío —`onShare={() => {}}`—, así que este helper también le da
 * destino al botón.
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

export async function sharePlace(placeId: string, placeName: string): Promise<void> {
  const url = `${window.location.origin}/place/${placeId}?utm_source=share&utm_medium=referral&utm_campaign=place_share`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: placeName,
        text: `Mira ${placeName} en La Verde`,
        url,
      });
      trackPlaceShared(placeId, placeName, "native");
      return;
    }

    await navigator.clipboard.writeText(url);
    trackPlaceShared(placeId, placeName, "clipboard");
    toast.success("Enlace copiado al portapapeles");
  } catch (error) {
    /* Cancelar la hoja nativa no es un fallo: no avisa y no registra. */
    if ((error as Error)?.name === "AbortError") return;
    toast.error("No se pudo compartir ahora mismo.");
  }
}
