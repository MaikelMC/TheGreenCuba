import { S3Client } from "@aws-sdk/client-s3";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME ?? "la-verde-images";
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? "";

/**
 * El endpoint S3 de R2 tiene siempre la misma forma: el id de cuenta —32
 * dígitos hexadecimales— y el dominio de Cloudflare. No hay otra.
 *
 * La comprobación existe por un error que ya nos costó un rato. Un endpoint de
 * plantilla (`xxx.r2.cloudflarestorage.com`) **resuelve en DNS**, porque
 * Cloudflare contesta al comodín, y luego se cae en el saludo TLS con un
 * `SSL alert number 40` que no menciona la configuración por ninguna parte. Se
 * parece a un problema de red, y esta máquina tiene una red mala de verdad, así
 * que se va a mirar ahí. Comprobar la forma aquí convierte ese callejón sin
 * salida en un mensaje que dice qué falta.
 */
const R2_ENDPOINT_SHAPE = /^https:\/\/[a-f0-9]{32}\.r2\.cloudflarestorage\.com\/?$/;

/** Qué le falta a la configuración de R2, o `null` si está completa. */
export function r2ConfigProblem(): string | null {
  if (!R2_ENDPOINT_SHAPE.test(process.env.R2_ENDPOINT ?? "")) {
    return "R2_ENDPOINT no es un endpoint de cuenta de R2. Cópialo de la consola de Cloudflare, en la configuración del bucket: termina en `<32 hex>.r2.cloudflarestorage.com`.";
  }
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    return "Faltan R2_ACCESS_KEY_ID o R2_SECRET_ACCESS_KEY.";
  }
  if (!R2_PUBLIC_URL) {
    return "Falta R2_PUBLIC_URL: las fotos se subirían sin poder mostrarse después.";
  }
  return null;
}
