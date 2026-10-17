import { chatJSON } from "@/lib/ai";
import {
  construirPromptPublicacion,
  firmar,
  normalizarVariantes,
  plantillaFallback,
  validarVariantes,
  type DatosPublicacion,
  type PedidoPublicacion,
  type PerfilPublicacion,
  type VariantePublicacion,
} from "@/lib/publicaciones";

/**
 * El generador de texto de la cola de publicaciones.
 *
 * Va por `chatJSON`, la misma cadena con failover que el buscador: **no elige
 * modelo a mano** porque la cadena configurada ya es la barata —Gemini Flash
 * Lite, gpt-oss, Mistral— y montar una selección por llamada sería un parámetro
 * más que mantener para no cambiar de tier.
 *
 * El modelo no se cree: se valida la respuesta y, si incumple las reglas, se le
 * devuelve la lista de fallos **una sola vez**. Si tampoco acierta, salen dos
 * textos fijos armados con los datos reales. La firma de La Verde se añade aquí,
 * después de validar, para que el enlace salga exacto y no cuente como segundo
 * enlace del cuerpo.
 *
 * Es un módulo aparte de `src/lib/publicaciones.ts` porque aquel es puro y este
 * habla con la red; mezclarlos dejaría el cálculo de la semana y la validación
 * sin poder probarse sin un proveedor de IA delante.
 */

const ESQUEMA_VARIANTES = {
  name: "publicacion",
  schema: {
    type: "object",
    properties: {
      variantes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            angulo: { type: "string", enum: ["directa", "antojo"] },
            texto: { type: "string" },
          },
          required: ["angulo", "texto"],
          additionalProperties: false,
        },
      },
    },
    required: ["variantes"],
    additionalProperties: false,
  },
} as const;

export interface ResultadoPublicacion {
  variantes: VariantePublicacion[];
  provider: string;
  /** `true` = el modelo no superó la validación y salió la plantilla fija. */
  fallback: boolean;
  /** Ficha sin descripción ni productos: el post se apoya solo en categoría y barrio. */
  datosEscasos: boolean;
}

export async function generarVariantesPublicacion(
  perfil: PerfilPublicacion,
  pedido: PedidoPublicacion = {},
): Promise<ResultadoPublicacion> {
  const { system, user } = construirPromptPublicacion(perfil, pedido);
  const datos: DatosPublicacion = {
    perfil,
    producto: pedido.producto,
    /* La dirección real no viaja al modelo, pero la validación la necesita para
       poder rechazar una fuga. */
    direccion: pedido.direccion,
  };
  const datosEscasos = !perfil.descripcion && perfil.productos.length === 0;

  let provider = "";
  let variantes: VariantePublicacion[] = [];
  let fallos: string[] = [];
  let mensaje = user;

  for (let intento = 0; intento < 2; intento += 1) {
    try {
      const respuesta = await chatJSON<{ variantes?: unknown }>({
        system,
        user: mensaje,
        /* gpt-oss gasta tokens en razonar y con 500 cortaba el JSON a la mitad. */
        maxTokens: 1000,
        temperature: 0.7,
        topP: 0.9,
        reasoningEffort: "low",
        jsonSchema: ESQUEMA_VARIANTES,
      });
      provider = respuesta.provider;
      variantes = normalizarVariantes(respuesta.data?.variantes);
      fallos = validarVariantes(variantes, datos);
      if (fallos.length === 0) break;
    } catch (error) {
      /* Un JSON roto o un proveedor caído cuentan igual: se reintenta con la
         misma corrección, y si vuelve a fallar sale la plantilla. */
      fallos = [
        error instanceof Error
          ? error.message.slice(0, 200)
          : "La respuesta no fue JSON válido.",
      ];
    }

    mensaje = `${user}\n\nCorrige: ${fallos.join(" ")}`;
  }

  const fallback = fallos.length > 0;
  if (fallback) variantes = plantillaFallback(datos);

  return {
    variantes: variantes.map((variante) => ({
      ...variante,
      texto: firmar(variante.texto, perfil.enlaceLaVerde),
    })),
    provider,
    fallback,
    datosEscasos,
  };
}
