/**
 * Los textos y los valores por defecto de la ficha.
 *
 * Todo lo que la ficha dice y no sale de la base vive aquí. Antes estaba
 * repartido por los componentes —y con él, los datos inventados: descripciones
 * de relleno, títulos fijos, mensajes de cierre escritos a mano—. Con un solo
 * archivo, cambiar una etiqueta no obliga a buscarla en cinco sitios y una
 * revisión puede comprobar de un vistazo que nada afirma algo que el negocio no
 * dijo.
 */

import {
  TIPOS_NEGOCIO,
  type MenuCategoria,
  type ModuloFicha,
  type TipoNegocio,
} from "@/lib/ficha/tipos";
import type { Acciones } from "@/lib/ficha/acciones";
import { atributosParaTipo, type AtributoClave } from "@/lib/ficha/atributos";
import {
  DIA_SEMANA_LABEL,
  DIAS_SEMANA,
  type EstadoApertura,
} from "@/lib/ficha/horario";

/**
 * Cuántas reseñas hacen falta para enseñar el promedio.
 *
 * Con una sola opinión, un 5 es una anécdota y no una valoración: la ficha lo
 * presentaría como si fuera la nota del negocio. Por debajo del mínimo se
 * enseña el número de reseñas, sin media.
 */
export const MIN_RESENAS_PARA_NOTA = 3;

/** El texto de la ficha, en un solo sitio. */
export const COPY = {
  verMas: "Ver más",
  verMenos: "Ver menos",
  verTodas: "Ver todas",
  pagos: "Pagos",

  abierto: "Abierto",
  cerrado: "Cerrado",
  cierraA: "Cierra a las",
  abreA: "Abre a las",
  abreManana: "Abre mañana a las",
  abreEl: "Abre el",

  resenas: "reseñas",
  resena: "reseña",
  sinResenas: "Todavía no hay reseñas",
  opinar: "Opinar",
  opiniones: "Opiniones",

  comoLlegar: "Cómo llegar",
  guardar: "Guardar",
  guardado: "Guardado",
  llamar: "Llamar",
  whatsapp: "WhatsApp",
  compartir: "Compartir",
  ofertas: "Ofertas",
  pedir: "Pedir",
  reservar: "Reservar",
  apartar: "Apartar",
  pedirCita: "Pedir cita",

  anadir: "Añadir",
  quitar: "Quitar",
  verPedido: "Ver pedido",
  vaciar: "Vaciar",

  oferta: "Oferta",
  verCarta: "Ver la carta",
  direccion: "Dirección",
  sitioWeb: "Sitio web",
  respuestaNegocio: "Respuesta del negocio",
  invitarResena: "Cuéntale a los demás cómo te pareció este lugar.",
  sobreElLugar: "Sobre este lugar",
  galeria: "Galería",
  elLocal: "El local",
  trabajos: "Trabajos realizados",
  sinFotos: "Fotos próximamente",
  contacto: "Contacto",
  verResenas: "Ver las reseñas",
  resenaDestacada: "Reseña destacada",
  verEnMapa: "Ver en el mapa",

  especialDelDia: "Especial del día",
  hastaEl: "Hasta el",
  envio: "Envío",
  pedidoMinimo: "Pedido mínimo",
  tiempoEntrega: "Entrega estimada",
  gratis: "Gratis",
  consultar: "A consultar",
  recoger: "Recoger en el local",
  apartarWhatsapp: "Apartar por WhatsApp",
  comoComprar: "Cómo comprar",
  comoAtiende: "Cómo atiende",

  actualizadoHace: "Actualizado",
  sinCatalogo: "Todavía no hay productos publicados",

  cerradoTemporal: "Cerrado temporalmente",
  conCita: "Con cita",
  sinCita: "Sin cita",
  aDomicilio: "A domicilio",

  agotado: "Agotado",
  pocas: "Quedan pocas",
  quedan: (n: number) => `Quedan ${n}`,
} as const;

/** El título del catálogo cuando el dueño no escribe uno. */
export const TITULO_CATALOGO_POR_TIPO: Record<TipoNegocio, string> = {
  comida_domicilio: "Lo que ofrece",
  cafeteria_restaurante: "Menú",
  tienda_mipyme: "Productos",
  servicios: "Servicios y precios",
};

/** Los módulos que se proponen al dar de alta, no los que se imponen. */
export const MODULOS_RECOMENDADOS_POR_TIPO: Record<
  TipoNegocio,
  readonly ModuloFicha[]
> = {
  comida_domicilio: ["domicilio"],
  cafeteria_restaurante: ["local"],
  tienda_mipyme: ["tienda"],
  servicios: ["servicios"],
};

/**
 * La fila de acciones de cada tipo al empezar.
 *
 * Se filtra después por los datos: un negocio sin teléfono no pinta «Llamar»
 * aunque esté aquí. Y siempre es solo el punto de partida: el dueño reordena.
 */
export const ACCIONES_POR_DEFECTO: Record<TipoNegocio, Acciones> = {
  comida_domicilio: {
    fila: ["como_llegar", "whatsapp", "llamar", "compartir"],
    barra: ["pedir", "como_llegar"],
  },
  cafeteria_restaurante: {
    fila: ["como_llegar", "llamar", "compartir", "guardar"],
    barra: ["reservar", "como_llegar"],
  },
  tienda_mipyme: {
    fila: ["como_llegar", "whatsapp", "compartir", "guardar"],
    barra: ["apartar", "como_llegar"],
  },
  servicios: {
    fila: ["como_llegar", "whatsapp", "llamar", "compartir"],
    barra: ["cita", "como_llegar"],
  },
};

/** Los atributos sugeridos por tipo, en el orden del catálogo. */
export const ATRIBUTOS_SUGERIDOS_POR_TIPO = Object.fromEntries(
  TIPOS_NEGOCIO.map((tipo) => [
    tipo,
    atributosParaTipo(tipo).map((a) => a.clave),
  ]),
) as Record<TipoNegocio, AtributoClave[]>;

/** La fila por defecto de una ficha sin tipo: lo que la ficha ya hacía. */
export const ACCIONES_SIN_TIPO: Acciones = {
  fila: ["como_llegar", "guardar", "compartir"],
  barra: [],
};

/** El título del catálogo cuando tampoco hay tipo. */
export const TITULO_CATALOGO_SIN_TIPO = "Catálogo";

/**
 * El título de la sección de catálogo, por orden de autoridad: lo que escribió
 * el dueño, lo que sugiere su tipo y, si no hay ninguno, el genérico.
 */
export function tituloCatalogo(
  propio: string | null | undefined,
  tipo: TipoNegocio | null | undefined,
): string {
  const escrito = propio?.trim();
  if (escrito) return escrito;
  return tipo ? TITULO_CATALOGO_POR_TIPO[tipo] : TITULO_CATALOGO_SIN_TIPO;
}

/** Las categorías de la carta, ordenadas por su campo `orden`. */
export function ordenarCategorias(
  categorias: readonly MenuCategoria[] | null | undefined,
): MenuCategoria[] {
  return [...(categorias ?? [])].sort((a, b) => a.orden - b.orden);
}

/** `"18:00"` → `"6:00 p. m."`. Vacío si la hora no es válida. */
export function hora12(hora: string): string {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora.trim());
  if (!m) return "";
  const h = Number(m[1]);
  const sufijo = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${sufijo}`;
}

/**
 * La frase de estado que se pinta, o `null` si no hay nada que decir.
 *
 * `null` es importante: una ficha sin horario no debe inventar «Cerrado» ni
 * «Abierto». El silencio es el único dato honesto que hay.
 */
export function textoEstado(estado: EstadoApertura): string | null {
  if (estado.mensaje) return estado.mensaje;
  if (estado.sinHorario) return null;

  if (estado.abierto) {
    const cierre = estado.cierraA ? hora12(estado.cierraA) : "";
    return cierre
      ? `${COPY.abierto} · ${COPY.cierraA} ${cierre}`
      : COPY.abierto;
  }

  if (estado.abreA) {
    const hora = hora12(estado.abreA);
    if (estado.diasHastaApertura === 0) {
      return `${COPY.cerrado} · ${COPY.abreA} ${hora}`;
    }
    if (estado.diasHastaApertura === 1) {
      return `${COPY.cerrado} · ${COPY.abreManana} ${hora}`;
    }
    const dia =
      estado.abreDia !== null ? DIAS_SEMANA[estado.abreDia] : undefined;
    const nombre = dia ? DIA_SEMANA_LABEL[dia] : "";
    return nombre
      ? `${COPY.cerrado} · ${COPY.abreEl} ${nombre} ${COPY.abreA} ${hora}`
      : COPY.cerrado;
  }

  return COPY.cerrado;
}
