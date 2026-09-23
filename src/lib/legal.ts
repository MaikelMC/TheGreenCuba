/**
 * Datos legales del sitio, en un solo archivo.
 *
 * La versión la leen tres sitios —la página de términos, la casilla del alta y
 * `POST /api/me`, que es quien la guarda— y los tres tienen que decir lo mismo.
 * Con una copia en cada uno, la primera edición del texto dejaría a los otros
 * dos afirmando una versión que ya no es la que se leyó, y la constancia de
 * aceptación guardada en la base apuntaría a un documento que no existe.
 *
 * `TERMS_VERSION` y `TERMS_UPDATED_LABEL` son el mismo día en dos formatos: el
 * primero es el que se guarda y con el que se compara, el segundo es el que se
 * enseña. Se cambian a la vez.
 */
export const TERMS_VERSION = "2026-09-23";

/** El mismo día que `TERMS_VERSION`, escrito para leerse. */
export const TERMS_UPDATED_LABEL = "septiembre de 2026";

/** La dirección que ya usaba el panel de negocio para soporte. */
export const SUPPORT_EMAIL = "soporte@laverde.cu";

/**
 * Quién responde de los datos.
 *
 * Todavía no hay entidad constituida, así que queda el hueco marcado en lugar de
 * inventarse un nombre. Un responsable falso es peor que uno pendiente: parece
 * que hay a quién reclamar y no lo hay.
 */
export const DATA_CONTROLLER = "[razón social y domicilio]";

/** Nombre en corto de lo mismo, para frases que no admiten el hueco. */
export const PLATFORM_NAME = "La Verde";
