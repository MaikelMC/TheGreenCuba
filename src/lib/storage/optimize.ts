import sharp from "sharp";

/**
 * Recomprime una imagen en el servidor, garantizando el tope de peso.
 *
 * El compresor principal sigue siendo el del navegador (`compress.ts`), que
 * ahorra subir bytes de más. Esto es la red de seguridad por dos motivos: un
 * navegador que no sabe decodificar el archivo —el HEIC de un iPhone abierto en
 * Chrome, que cae al original— subiría la foto sin comprimir, y el tope de peso
 * tiene que cumplirse igual. Además unifica todo a WebP, que es lo que se sirve.
 *
 * `sharp` ya estaba disponible: es dependencia transitiva de Next —que lo usa
 * para optimizar imágenes— y `scripts/generate-icons.mjs` ya lo importa. Se
 * declara ahora en `package.json` para que un cambio de versión de Next no lo
 * rompa en silencio.
 *
 * Se prueban calidades de **≤70 y bajando** antes que resoluciones, porque el
 * ojo nota más un borde blando que un poco de artefacto: primero se aprieta el
 * JPEG/WebP y solo si no basta se reduce el lado. Las entradas de la lista están
 * ordenadas de mayor a menor, así que la primera que quepa es la mejor calidad
 * posible por debajo del tope.
 */

/** Tope duro del archivo que se guarda en el bucket. */
export const MENU_IMAGE_MAX_BYTES = 150 * 1024;

/* Lado y calidad, de mejor a peor. 1000 px cubre la foto del menú a 2x en
   cualquier pantalla del sitio y sobra para el recorte. */
const STEPS: { edge: number; quality: number }[] = [
  { edge: 1000, quality: 70 },
  { edge: 1000, quality: 62 },
  { edge: 900, quality: 55 },
  { edge: 800, quality: 50 },
  { edge: 700, quality: 45 },
  { edge: 600, quality: 40 },
  { edge: 480, quality: 35 },
  { edge: 360, quality: 30 },
];

/**
 * Devuelve los bytes de un WebP por debajo del tope. Lanza si `sharp` no puede
 * leer la entrada; quien llama decide qué hacer entonces (aquí, subir el
 * original, que ya pasó por el tope de `MAX_UPLOAD_BYTES`).
 */
export async function optimizeImage(input: Uint8Array): Promise<Uint8Array> {
  const source = Buffer.from(input);
  let last: Buffer | null = null;

  for (const step of STEPS) {
    const out = await sharp(source)
      /* `rotate()` sin argumento aplica la orientación EXIF y la quita: sin esto
         una foto vertical de móvil se guardaría girada. */
      .rotate()
      .resize({
        width: step.edge,
        height: step.edge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: step.quality })
      .toBuffer();

    last = out;
    if (out.byteLength <= MENU_IMAGE_MAX_BYTES) return new Uint8Array(out);
  }

  /* Ni con la peor combinación se bajó del tope: una imagen imposible. Se
     devuelve lo último generado —sigue siendo WebP y muchísimo más pequeño que
     el original— en vez de fallar la subida. */
  return new Uint8Array(last ?? source);
}
