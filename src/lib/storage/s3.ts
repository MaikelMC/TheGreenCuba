import { S3Client } from "@aws-sdk/client-s3";

/**
 * Cliente S3 contra Neon Object Storage.
 *
 * Antes esto apuntaba a Cloudflare R2. El cambio costó poco porque Neon también
 * habla S3 y el SDK es el mismo; lo que cambió fue la forma del endpoint y dos
 * detalles del protocolo que R2 toleraba y Neon no.
 *
 * **Neon es path-style y esto no es opcional.** El SDK v3, con un endpoint
 * propio, arma por defecto `<bucket>.<endpoint>/<key>`, es decir
 * `la-verde-images.br-….storage.….neon.tech`. Ese nombre no existe en DNS: el
 * bucket no es un subdominio del endpoint, es un segmento de la ruta. Sin
 * `forcePathStyle` la subida no falla con un mensaje de configuración, falla
 * con un `ENOTFOUND` que apunta a la red —y esta máquina tiene una red mala de
 * verdad, así que se va a mirar ahí y no aquí.
 *
 * El endpoint es **por rama**. Estas credenciales valen en su rama y en las que
 * descienden de ella, y en ninguna más: lo que se suba desde una rama de
 * preview no aparece en la principal.
 */

/** Sin la barra final: se concatena con rutas y con `/` doble no casaría nada. */
const ENDPOINT = (process.env.AWS_ENDPOINT_URL_S3 ?? "").replace(/\/+$/, "");

export const S3_BUCKET = process.env.S3_BUCKET_NAME ?? "la-verde-images";

export const s3Client = new S3Client({
  /* Neon exige una región de verdad. R2 aceptaba `auto`; aquí eso no es una
     región y la firma no valida. */
  region: process.env.AWS_REGION || "us-east-2",
  endpoint: ENDPOINT,
  forcePathStyle: true,
  /* El SDK 3.1095 calcula un checksum y lo manda en el `PutObject` por defecto
     (`WHEN_SUPPORTED`). Los servicios S3 que no lo implementan contestan con un
     400 pelado que no menciona los checksums, y aquí se acabaría buscando en la
     red. `WHEN_REQUIRED` lo sigue mandando cuando la operación de verdad lo
     pide, así que no se pierde nada. */
  requestChecksumCalculation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

/**
 * Raíz desde la que se leen las fotos sin credencial. Neon sirve los objetos
 * de un bucket `public_read` en `<endpoint>/<bucket>/<clave>`, así que sale de
 * las dos variables de arriba y no hace falta una tercera que se pueda
 * desincronizar.
 *
 * El bucket es `private` por defecto y eso **no** se cambia por S3: hay que
 * ponerlo en la consola o en la API de Neon. Con un bucket privado esta URL
 * devuelve 403 y la ficha pública se queda sin fotos.
 */
export const S3_PUBLIC_URL = ENDPOINT ? `${ENDPOINT}/${S3_BUCKET}` : "";

/**
 * Forma del endpoint de una rama: un id de rama, el servicio, la celda, la
 * región y el dominio de Neon.
 *
 * La comprobación existe por un error que ya costó un rato con R2. Un endpoint
 * de plantilla **resuelve en DNS** porque el proveedor contesta al comodín, y
 * luego se cae en el saludo TLS con un `SSL alert number 40` que no menciona la
 * configuración por ninguna parte. Se parece a un problema de red y se va a
 * buscar ahí. Comprobar la forma aquí convierte ese callejón sin salida en un
 * mensaje que dice qué falta.
 */
const ENDPOINT_SHAPE =
  /^https:\/\/[a-z0-9-]+\.storage\.c-\d+\.[a-z0-9-]+\.aws\.neon\.tech$/;

/** Qué le falta a la configuración, o `null` si está completa. */
export function s3ConfigProblem(): string | null {
  if (!ENDPOINT_SHAPE.test(ENDPOINT)) {
    return "AWS_ENDPOINT_URL_S3 no es un endpoint de almacenamiento de Neon. Cópialo de la consola, en Branch → Storage: termina en `<rama>.storage.c-N.<región>.aws.neon.tech`.";
  }
  if (!process.env.AWS_REGION || process.env.AWS_REGION === "auto") {
    return "Falta AWS_REGION, o vale `auto`. Neon necesita la región de verdad de la rama (`us-east-2`, `us-east-1`, `eu-central-1`, `ap-southeast-1`).";
  }
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return "Faltan AWS_ACCESS_KEY_ID o AWS_SECRET_ACCESS_KEY.";
  }
  return null;
}
