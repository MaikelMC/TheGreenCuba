import { chatJSON } from "@/lib/ai";
import {
  construirPromptPublicacion,
  normalizarVariantes,
  type PerfilPublicacion,
} from "@/lib/publicaciones";

/**
 * El generador de texto de la cola de publicaciones.
 *
 * Va por `chatJSON`, la misma cadena con failover que el buscador: **no elige
 * modelo a mano** porque la cadena configurada ya es la barata —Mistral Small,
 * Gemini Flash Lite, gpt-oss— y montar una selección por llamada sería un
 * parámetro más que mantener para no cambiar de tier. Lo que sí se aprieta es el
 * presupuesto: 500 tokens de salida para dos textos de dos o tres frases.
 *
 * Es un módulo aparte de `src/lib/publicaciones.ts` porque aquel es puro y este
 * habla con la red; mezclarlos dejaría el cálculo de la semana y la validación
 * sin poder probarse sin un proveedor de IA delante.
 */
export async function generarVariantesPublicacion(
  perfil: PerfilPublicacion,
): Promise<{ variantes: string[]; provider: string }> {
  const { system, user } = construirPromptPublicacion(perfil);
  const { data, provider } = await chatJSON<{ variantes?: unknown }>({
    system,
    user,
    maxTokens: 500,
    /* Alta: las dos variantes tienen que sonar distintas entre sí y no como la
       misma frase dos veces. */
    temperature: 0.8,
  });
  return { variantes: normalizarVariantes(data?.variantes), provider };
}
