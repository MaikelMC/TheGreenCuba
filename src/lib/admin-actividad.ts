import { desc, gte, sql } from "drizzle-orm";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { adminActividad } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";

/**
 * El registro de actividad del panel.
 *
 * `registrarActividad` es el único punto de escritura. Lo llaman las rutas de
 * administración **después** de que el cambio cuaje y antes de responder: si la
 * acción falla, no hay entrada, y si la entrada falla, la acción ya está hecha
 * —el registro no puede ser la razón por la que un pago confirmado se deshace—.
 * Por eso el `insert` se captura y se registra en consola.
 *
 * Quién es el administrador se pregunta aquí con `getAppUser`, salvo que quien
 * llama ya lo sepa. Las acciones automáticas —el webhook de QvaPay, los envíos
 * programados— pasan `adminId: null` y `adminNombre: "Sistema"`.
 */

/** Nombres estables de acción. Se guardan tal cual en `admin_actividad.accion`. */
export const ACCION = {
  crearNegocio: "crear_negocio",
  borrarNegocio: "borrar_negocio",
  aprobarSolicitud: "aprobar_solicitud",
  rechazarSolicitud: "rechazar_solicitud",
  pedirCambiosSolicitud: "pedir_cambios_solicitud",
  editarNegocio: "editar_negocio",
  destacarNegocio: "destacar_negocio",
  quitarDestacado: "quitar_destacado",
  cambiarPlan: "cambiar_plan",
  cambiarSuscripcion: "cambiar_suscripcion",
  confirmarPago: "confirmar_pago",
  rechazarPago: "rechazar_pago",
  publicar: "publicar_publicacion",
  editarPublicacion: "editar_publicacion",
  borrarPublicacion: "borrar_publicacion",
  responderSoporte: "responder_soporte",
  cerrarConversacion: "cerrar_conversacion",
  cambiarEstadoSoporte: "cambiar_estado_soporte",
  asignarConversacion: "asignar_conversacion",
  editarRespuestaGuardada: "editar_respuesta_guardada",
  cambiarRol: "cambiar_rol",
  restablecerContrasena: "restablecer_contrasena",
  borrarUsuario: "borrar_usuario",
  enviarAviso: "enviar_aviso",
  editarPrecios: "editar_precios",
  editarCategorias: "editar_categorias",
  editarProveedorIa: "editar_proveedor_ia",
  editarVinculo: "editar_vinculo",
  editarPack: "editar_pack",
  aprobarProyecto: "aprobar_proyecto",
  rechazarProyecto: "rechazar_proyecto",
  borrarProyecto: "borrar_proyecto",
  editarUsuario: "editar_usuario",
  activarAfiliado: "activar_afiliado",
  marcarCobroAfiliado: "marcar_cobro_afiliado",
  premioAfiliado: "premio_afiliado",
  liquidarAfiliado: "liquidar_afiliado",
  notaAfiliado: "nota_afiliado",
  quitarAfiliacion: "quitar_afiliacion",
  notaNegocio: "nota_negocio",
} as const;

export type AccionActividad = (typeof ACCION)[keyof typeof ACCION];

export interface EntradaActividad {
  accion: string;
  objetoTipo: string;
  objetoId?: string | null;
  /** Frase completa y legible: «Aprobó la ficha de El Palmar». */
  resumen: string;
  datos?: Record<string, unknown> | null;
  /** Solo para acciones automáticas o cuando el actor ya se conoce. */
  adminId?: string | null;
  adminNombre?: string | null;
}

/**
 * Escribe una entrada en el registro. Nunca lanza.
 *
 * El registro es obligatorio por política, pero no puede tumbar la acción que
 * documenta: si la base rechaza esta fila, lo que se pierde es la traza y no el
 * pago, la aprobación o el envío. El fallo queda en consola del servidor.
 */
export async function registrarActividad(
  entrada: EntradaActividad,
): Promise<void> {
  let actor: Awaited<ReturnType<typeof getAppUser>> = null;
  if (entrada.adminId === undefined) {
    actor = await getAppUser().catch(() => null);
  }

  const adminId =
    entrada.adminId === undefined ? (actor?.id ?? null) : entrada.adminId;
  const adminNombre =
    entrada.adminNombre ??
    actor?.name ??
    (adminId ? "Administración" : "Sistema");

  try {
    await db.insert(adminActividad).values({
      id: generateId(),
      adminId,
      adminNombre,
      accion: entrada.accion,
      objetoTipo: entrada.objetoTipo,
      objetoId: entrada.objetoId ?? null,
      resumen: entrada.resumen,
      datos: entrada.datos ?? null,
    });
  } catch (error) {
    console.error("No se pudo registrar la actividad del panel:", error);
  }
}

export type RangoActividad = "24h" | "7d" | "todo";

const HORAS_24 = 24 * 60 * 60 * 1000;
const DIAS_7 = 7 * HORAS_24;

/**
 * Las últimas entradas, filtradas por rango. El rango por defecto son 24 horas
 * y no el día natural: el panel se usa desde dos husos y «hoy» en La Habana no
 * es «hoy» en el servidor, así que la ventana se cuenta hacia atrás desde ahora.
 */
export async function listarActividad({
  rango = "24h",
  limite = 100,
}: {
  rango?: RangoActividad;
  limite?: number;
} = {}) {
  const desde =
    rango === "todo"
      ? null
      : new Date(Date.now() - (rango === "24h" ? HORAS_24 : DIAS_7));

  const where = desde ? gte(adminActividad.creadoEn, desde) : undefined;

  return db
    .select()
    .from(adminActividad)
    .where(where)
    .orderBy(desc(adminActividad.creadoEn))
    .limit(Math.min(Math.max(limite, 1), 500));
}

/** Cuántas entradas hay en un rango, para el resumen de la sección. */
export async function contarActividad(
  rango: RangoActividad = "24h",
): Promise<number> {
  const desde =
    rango === "todo"
      ? null
      : new Date(Date.now() - (rango === "24h" ? HORAS_24 : DIAS_7));
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(adminActividad)
    .where(desde ? gte(adminActividad.creadoEn, desde) : undefined);
  return row?.total ?? 0;
}
