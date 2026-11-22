import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { db } from "@/lib/db";
import {
  codigoVerificacionEmailHtml,
  enlaceResetEmailHtml,
  sendEmail,
} from "@/lib/email";
import {
  authAccount,
  authSession,
  authUser,
  authVerification,
} from "./schema";

/**
 * Better Auth autoalojado, sobre el Postgres del VPS.
 *
 * Antes esto era `createNeonAuth`, que hablaba con el servicio de Neon por
 * HTTPS. Ya no hay servicio: las tablas son las mismas de `neon_auth` —no se
 * renombran— y el adaptador de Drizzle las usa tal cual, con sus ids y sus
 * contraseñas. Las cuentas existentes siguen entrando con la misma contraseña:
 * Neon Auth monta Better Auth 1.6.23 por dentro y guarda los hashes con el
 * mismo scrypt (`salt:hash`) que usa esta versión.
 *
 * Lo que cambia es quién manda el correo. Neon lo enviaba por su cuenta; ahora
 * los códigos y los enlaces salen por el mismo Resend que el resto de la app
 * (`src/lib/email.ts`), así que un `RESEND_API_KEY` sin configurar deja la
 * verificación y la recuperación sin correo, igual que los avisos de negocio.
 *
 * Las dos variables nuevas no tienen valor por defecto a propósito: con una
 * cadena vacía la app arrancaría con la autenticación averiada y fallaría en el
 * primer acceso, con un error que no señala al sitio.
 *
 * `BETTER_AUTH_URL` es el origen público de la app (el mismo que
 * `NEXT_PUBLIC_APP_URL`): Better Auth lo usa para armar los enlaces de los
 * correos y para validar el origen de las peticiones.
 */
const secret = process.env.BETTER_AUTH_SECRET?.trim();
const baseURL = process.env.BETTER_AUTH_URL?.trim();

if (!secret) {
  throw new Error(
    "Falta BETTER_AUTH_SECRET. Genérala con: openssl rand -base64 32",
  );
}
if (!baseURL) {
  throw new Error(
    "Falta BETTER_AUTH_URL. Debe ser el origen público de la app, p. ej. https://laverde.cu",
  );
}

const APP_ORIGIN = baseURL.replace(/\/+$/, "");

/* Better Auth rechaza con 403 («Invalid origin») toda petición cuyo `Origin` no
   case con `baseURL`. En el corte eso es justo lo que se quiere: la app vive en
   su dominio y nada más entra. Pero al probar en local, `baseURL` apunta al
   dominio de producción y el navegador manda `http://localhost:3000`, que no
   casa. Por eso, y **solo fuera de producción**, se añade localhost a los
   orígenes de confianza; en producción la lista es solo el dominio real. */
const trustedOrigins =
  process.env.NODE_ENV === "production"
    ? [APP_ORIGIN]
    : [APP_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000"];

/* Google es opcional: sin las dos variables el resto del acceso funciona y el
   botón de Google devuelve el error del proveedor. Las credenciales se crean
   en la consola de Google Cloud; antes las guardaba Neon y ahora son nuestras. */
const googleId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

export const auth = betterAuth({
  appName: "La Verde",
  secret,
  baseURL,
  basePath: "/api/auth",
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
    },
  }),
  user: {
    /* `neon_auth.user.role` existe desde Neon y el panel de administración
       todavía la escribe. Better Auth no la usa para nada —el rol real vive en
       `public.users`—, pero declararla evita que el adaptador la ignore al
       leer y que un insert la deje a `null` si la columna no admite nulos. */
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
      },
    },
  },
  session: {
    /* La misma vida que tenían las sesiones de Neon: siete días. */
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    database: {
      /* Los ids de `neon_auth` son uuid y `public.users.auth_user_id` se
         compara con `::uuid` en varias consultas. Un id de texto arbitrario
         rompería esos casts. */
      generateId: () => randomUUID(),
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    /* La verificación no se exige aquí, sino en el proxy: así el alta emite
       sesión igual que hacía Neon y `/api/me` puede guardar el teléfono y la
       aceptación de los términos antes del código. El proxy manda a
       `/verify-email` a toda sesión con el correo sin verificar. */
    requireEmailVerification: false,
    autoSignIn: true,
    sendResetPassword: async ({ user, token }) => {
      const url = `${APP_ORIGIN}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}`;
      await sendEmail({
        to: [user.email],
        subject: "Tu contraseña nueva en La Verde",
        html: enlaceResetEmailHtml({ url }),
      });
    },
  },
  emailVerification: {
    /* Quien verifica desde la pantalla del código ya tiene sesión; esto cubre
       el caso de haber entrado por el enlace sin ella. */
    autoSignInAfterVerification: true,
  },
  ...(googleId && googleSecret
    ? {
        socialProviders: {
          google: {
            clientId: googleId,
            clientSecret: googleSecret,
            prompt: "select_account" as const,
          },
        },
      }
    : {}),
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 5 * 60,
      allowedAttempts: 3,
      /* El alta y el acceso usan código de seis dígitos, no un enlace: es la
         pantalla que ya existe (`/verify-email`). */
      overrideDefaultEmailVerification: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        const esAlta = type === "email-verification";
        await sendEmail({
          to: [email],
          subject: esAlta
            ? "Tu código de verificación de La Verde"
            : "Tu código de acceso a La Verde",
          html: codigoVerificacionEmailHtml({
            codigo: otp,
            titulo: esAlta ? "Verifica tu correo" : "Tu código de acceso",
          }),
        });
      },
    }),
  ],
});
