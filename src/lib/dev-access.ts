/**
 * La puerta de atrás del desarrollo: entrar sin pasar por Neon.
 *
 * En local, cada recarga de `/home` cuesta una ida y vuelta a Neon que solo
 * sirve para decir que sigues siendo tú. Esto la salta con una cookie que se
 * pone una vez desde `/dev-login` y dura un mes.
 *
 * **Está cerrado en producción por partida doble, y las dos hacen falta:** la
 * cookie no protege nada por sí sola —cualquiera la escribe a mano en el
 * navegador—, así que quien manda es `devAccessEnabled()`, que es `false` en
 * cuanto `NODE_ENV` es `production`. Con `next build` esto es código muerto y
 * la ruta `/dev-login` devuelve 404; en la máquina de quien desarrolla, ambas
 * cosas están vivas.
 *
 * No hay token ni contraseña a propósito: la cerradura es el entorno, no la
 * cookie, y un segundo secreto en `.env` sería otra cosa que mantener de
 * acuerdo entre dos archivos para no ganar nada.
 */
export const DEV_COOKIE = "lv-dev-access";

/** Quién eres cuando entras por la puerta de atrás. */
export interface DevIdentity {
  id: string;
  email: string;
  name: string;
}

/**
 * El `id` es el `authUserId` con el que `getAppUser` busca la fila en `users`:
 * la primera vez que se usa esto, la crea. Es una fila más en la base de
 * desarrollo, con un correo que no existe en Neon — no hay sesión que la
 * respalde y por eso nada de aquí sirve fuera de local.
 */
export const DEV_IDENTITY: DevIdentity = {
  id: "dev-local",
  email: "dev@local",
  name: "Sesión local",
};

export function devAccessEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** La cookie trae `1` cuando está puesta; cualquier otro valor no vale. */
export function isDevCookie(value: string | undefined): boolean {
  return value === "1";
}
