/**
 * Pruebas de la traducción de errores de autenticación contra los payloads
 * REALES que responde la API de Neon Auth (capturados sondeando su API
 * directamente). Falla con exit 1 si algún caso no se cumple.
 */
import { messageFor } from "@/lib/auth/error-messages";

let passed = 0;
let failed = 0;

function check(name: string, actual: string, expectedContains: string): void {
  const ok = actual.includes(expectedContains);
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? "✅" : "❌"} ${name}\n   → "${actual}"`);
}

/* Payloads tal como los devolvió la API (sondeos del 2026-09-26). */

check(
  "contraseña corta (PASSWORD_TOO_SHORT, HTTP 400)",
  messageFor({ code: "PASSWORD_TOO_SHORT", message: "Password too short", status: 400 }, "register"),
  "al menos 8 caracteres",
);

check(
  "correo inválido (VALIDATION_ERROR, HTTP 400)",
  messageFor({ code: "VALIDATION_ERROR", message: "[body.email] Invalid email address", status: 400 }, "register"),
  "formato válido",
);

check(
  "correo duplicado (USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL, HTTP 422)",
  messageFor({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", message: "User already exists. Use another email.", status: 422 }, "register"),
  "ya tiene una cuenta",
);

check(
  "login contraseña mala (INVALID_EMAIL_OR_PASSWORD, HTTP 401)",
  messageFor({ code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password", status: 401 }, "login"),
  "Correo o contraseña incorrectos",
);

check(
  "login usuario inexistente → MISMO mensaje (no confirma qué correos existen)",
  messageFor({ code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password", status: 401 }, "login"),
  "Correo o contraseña incorrectos",
);

check(
  "500 del servidor",
  messageFor({ status: 503, message: "Service Unavailable" }, "register"),
  "no responde",
);

check(
  "400 genérico en registro → pide revisar datos",
  messageFor({ status: 400, message: "Bad Request" }, "register"),
  "Revisa los datos",
);

check(
  "400 genérico en login → credenciales (no culpa al servidor)",
  messageFor({ status: 400, message: "Bad Request" }, "login"),
  "Correo o contraseña incorrectos",
);

check(
  "error envuelto del SDK ({ error: { code, message } }) también se entiende",
  messageFor({ error: { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", message: "User already exists" } }, "register"),
  "ya tiene una cuenta",
);

check(
  "basura desconocida → mensaje de último recurso por modo",
  messageFor("algo raro", "login"),
  "No se pudo entrar",
);
check(
  "basura desconocida en registro → su propio texto",
  messageFor(undefined, "register"),
  "No se pudo crear la cuenta",
);

console.log(`\n${failed === 0 ? "🟢" : "🔴"} ${passed} pasan, ${failed} fallan`);
if (failed > 0) process.exit(1);
