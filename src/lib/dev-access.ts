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
 *
 * Tiene forma de uuid a propósito, aunque no lo sea de nadie: `auth_user_id` es
 * `text`, pero el esquema de Neon contra el que se compara sí es uuid, y sitios
 * como `isGoogleAccount` castean sin preguntar. Un valor suelto aquí reventaba
 * cualquier consulta a `neon_auth` —y la de las novedades se llevaba por delante
 * el final del onboarding entero—.
 */
export const DEV_IDENTITY: DevIdentity = {
  id: "00000000-0000-4000-8000-000000000000",
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
