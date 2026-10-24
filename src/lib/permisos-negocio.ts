/**
 * Qué puede hacer un trabajador dentro del panel de un negocio.
 *
 * Es un módulo puro —sin base de datos ni Next— porque lo comparten el
 * servidor, que decide de verdad, y el cliente, que solo pinta los
 * interruptores. Si esto importara `db`, el panel arrastraría el driver al
 * navegador.
 *
 * El dueño no aparece aquí: su fila en `business_owners` tiene `rol = owner` y
 * no se le consulta la lista. Los permisos solo recortan a los trabajadores.
 */

export const PERMISOS_NEGOCIO = [
  {
    clave: "catalogo",
    label: "Editar el catálogo",
    descripcion: "Productos, precios, disponibilidad y ofertas.",
  },
  {
    clave: "ficha",
    label: "Editar la ficha",
    descripcion: "Nombre, contacto, horario, fotos y estado del negocio.",
  },
  {
    clave: "pedidos",
    label: "Atender pedidos",
    descripcion: "Ver el historial y marcar pedidos como completados.",
  },
  {
    clave: "telegram",
    label: "Usar el asistente",
    descripcion:
      "Vincular su Telegram y usar el bot. En el chat solo puede hacer lo que tenga marcado aquí.",
  },
] as const;

export type PermisoNegocio = (typeof PERMISOS_NEGOCIO)[number]["clave"];

const CLAVES = new Set<string>(PERMISOS_NEGOCIO.map((p) => p.clave));

export function esPermisoNegocio(valor: unknown): valor is PermisoNegocio {
  return typeof valor === "string" && CLAVES.has(valor);
}

/**
 * Deja solo los permisos conocidos, sin repetidos y en el orden de la lista.
 *
 * Se aplica siempre en el servidor: el cuerpo lo escribe el navegador y un
 * permiso inventado no debe llegar a la columna. El orden fijo hace que dos
 * guardados equivalentes escriban el mismo valor y que la interfaz no baile.
 */
export function normalizarPermisos(valor: unknown): PermisoNegocio[] {
  if (!Array.isArray(valor)) return [];
  const pedidos = new Set(valor.filter(esPermisoNegocio));
  return PERMISOS_NEGOCIO.map((p) => p.clave).filter((clave) => pedidos.has(clave));
}

/**
 * Qué permiso exige una acción del asistente de Telegram.
 *
 * `null` es una acción de solo lectura —consultar la carta o las cifras— y no
 * exige nada más allá de poder usar el asistente. Está aquí y no en
 * `asistente-server.ts` para que el servidor no tenga una segunda lista de
 * acciones que se desincronice con esta.
 */
export function permisoDeAccion(accion: string | null | undefined): PermisoNegocio | null {
  switch (accion) {
    case "set_disponibilidad":
    case "set_precio":
    case "editar_producto":
    case "eliminar_producto":
    case "agregar_productos":
      return "catalogo";
    case "set_horario":
    case "abrir_cerrar_hoy":
      return "ficha";
    default:
      return null;
  }
}
