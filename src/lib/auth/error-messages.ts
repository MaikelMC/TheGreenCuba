/**
 * Traducción de los errores de autenticación a mensajes que el usuario entiende.
 *
 * Módulo aparte del componente a propósito: las funciones son puras y así las
 * prueban los scripts contra los payloads REALES que responde la API de Neon
 * Auth (capturados con sondeos a `/sign-up/email` y `/sign-in/email`), sin
 * arrastrar el SDK al entorno de prueba.
 */

/** El modo solo cambia el texto del último recurso: el «algo falló» genérico. */
export type AuthErrorMode = "login" | "register";

/**
 * Texto del error que se enseña.
 *
 * El SDK devuelve `{ data, error }` y no lanza, así que el error de credenciales
 * llega como dato, no como excepción. Su mensaje viene en inglés y con su
 * vocabulario, así que no se enseña tal cual.
 *
 * Para credenciales malas se devuelve **uno solo** para los dos casos: decir
 * «ese correo no existe» por separado confirma qué correos están dados de alta.
 *
 * Los códigos de abajo son los que el backend responde de verdad:
 * `PASSWORD_TOO_SHORT` y `VALIDATION_ERROR` con HTTP 400 al crear la cuenta,
 * `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` con HTTP 422 si el correo ya está, e
 * `INVALID_EMAIL_OR_PASSWORD` con HTTP 401 al entrar. La longitud mínima la
 * pone Neon (8) y su mensaje no trae la cifra; por eso el formulario la valida
 * antes de enviar y aquí solo es la red de seguridad.
 */
export function messageFor(error: unknown, mode: AuthErrorMode): string {
  const value = error && typeof error === "object"
    ? (error as Record<string, unknown>)
    : {};
  const nested = value.error && typeof value.error === "object"
    ? (value.error as Record<string, unknown>)
    : {};
  const errorCode = String(value.code ?? nested.code ?? "").toUpperCase();
  const errorMessage = String(value.message ?? nested.message ?? "").toLowerCase();
  const errorText = `${errorCode} ${errorMessage} ${collectErrorText(error)}`.toLowerCase();
  const status = Number(value.status ?? nested.status ?? value.statusCode ?? nested.statusCode);

  if (
    errorCode === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
    errorCode === "USER_ALREADY_EXISTS" ||
    errorText.includes("already exists") ||
    errorText.includes("already registered") ||
    errorText.includes("user_already_exists") ||
    errorText.includes("email_exists")
  ) {
    return "Ese correo ya tiene una cuenta. Entra en su lugar.";
  }
  if (errorCode === "PASSWORD_TOO_SHORT" || errorText.includes("password too short")) {
    return "La contraseña necesita al menos 8 caracteres.";
  }
  /* 401 ANTES que el chequeo de formato: «INVALID_EMAIL_OR_PASSWORD» contiene
     la subcadena «invalid email» y sin este orden el login con contraseña mal
     decía «el correo no tiene un formato válido». */
  if (status === 401 || errorCode === "INVALID_EMAIL_OR_PASSWORD") {
    return "Correo o contraseña incorrectos.";
  }
  if (errorCode === "INVALID_EMAIL" || errorText.includes("invalid email")) {
    return "El correo no tiene un formato válido. Revísalo.";
  }
  if (status === 400 || status === 422 || errorCode === "VALIDATION_ERROR") {
    return mode === "register"
      ? "Revisa los datos: el correo o la contraseña no son válidos."
      : "Correo o contraseña incorrectos.";
  }
  if (status >= 500) {
    return "La autenticación no responde. Inténtalo en un momento.";
  }
  return mode === "login"
    ? "No se pudo entrar. Inténtalo de nuevo."
    : "No se pudo crear la cuenta. Inténtalo de nuevo.";
}

function collectErrorText(value: unknown, depth = 0): string {
  if (depth > 3 || value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);

  const record = value as Record<string, unknown>;
  const keys = ["code", "message", "name", "statusText", "cause", "data", "details", "response"];
  return keys
    .map((key) => collectErrorText(record[key], depth + 1))
    .filter(Boolean)
    .join(" ");
}
