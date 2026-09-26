/**
 * Genera todos los iconos del sitio a partir de `public/logo.png` — el logo
 * que ya usa el sitio en cabeceras, landing y splash. Ninguna imagen nueva:
 * este script solo lo reescala y lo acomoda en los formatos que pide cada
 * contexto (pestaña del navegador, pantalla de inicio de iOS/Android).
 *
 * El logo trae transparencia muerta alrededor del dibujo (~77% del ancho del
 * lienzo es corazón, el resto aire). Metido tal cual en un icono, el dibujo
 * queda pequeño rodeado de fondo — fue exactamente lo que se vio al agregar
 * el sitio a la pantalla de inicio de iOS. Por eso aquí primero se recorta a
 * su caja real (`extract` sobre el bounding box medido) y después se escala:
 * el arte toca arriba y abajo del icono, y el fondo solo asoma en los lados.
 *
 * Salidas:
 *  - src/app/favicon.ico            16/32/48 en un solo ICO → pestaña y marcadores
 *  - src/app/icon.png               512×512 transparente    → icono moderno
 *  - src/app/apple-icon.png         180×180 cielo del hero  → iOS (no admite alfa)
 *  - public/icons/icon-192.png      manifest any
 *  - public/icons/icon-512.png      manifest any
 *  - public/icons/icon-512-maskable.png  manifest maskable (logo al 66% sobre el cielo)
 *
 * Uso: `node scripts/generate-icons.mjs` — correr de nuevo si cambia el logo.
 * `sharp` ya viene con Next (`next build` lo usa para optimizar imágenes).
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const SOURCE = "public/logo.png";
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
/** Umbral de alfa para considerar un píxel parte del dibujo. */
const ALPHA_THRESHOLD = 8;

/**
 * El "cielo" del hero de la landing: `.lv-grid-glow` en `globals.css`, una
 * base degradada vertical (#06211a → #081b12) con dos brillos radiales
 * verdes encima. Reproducido en SVG para que el icono y la pantalla de
 * arranque compartan el mismo aire que la primera pantalla que ve quien
 * llega al sitio.
 *
 * Los radiales van con el radio CSS real —`farthest-corner` es el default de
 * `radial-gradient`, y en un lienzo cuadrado son 1.189·S y 1.312·S para los
 * centros (20%, 12%) y (85%, 0%)— para que el brillo caiga donde cae en la
 * landing y no a ojo.
 */
function heroGlowSvg(size) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<defs>` +
      `<linearGradient id="base" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#06211a"/>` +
      `<stop offset="1" stop-color="#081b12"/>` +
      `</linearGradient>` +
      `<radialGradient id="glow1" gradientUnits="userSpaceOnUse" cx="${size * 0.2}" cy="${size * 0.12}" r="${size * 1.1893}">` +
      `<stop offset="0" stop-color="#35AF6D" stop-opacity="0.16"/>` +
      `<stop offset="0.42" stop-color="#35AF6D" stop-opacity="0"/>` +
      `</radialGradient>` +
      `<radialGradient id="glow2" gradientUnits="userSpaceOnUse" cx="${size * 0.85}" cy="0" r="${size * 1.312}">` +
      `<stop offset="0" stop-color="#0F7A41" stop-opacity="0.18"/>` +
      `<stop offset="0.45" stop-color="#0F7A41" stop-opacity="0"/>` +
      `</radialGradient>` +
      `</defs>` +
      `<rect width="${size}" height="${size}" fill="url(#base)"/>` +
      `<rect width="${size}" height="${size}" fill="url(#glow1)"/>` +
      `<rect width="${size}" height="${size}" fill="url(#glow2)"/>` +
      `</svg>`,
  );
}

/**
 * Caja mínima que contiene todo el dibujo (píxeles con alfa sobre el umbral).
 * Medirlo y no hardcodearlo: si el logo cambia, el recorte se adapta solo.
 */
async function tightBox() {
  const { data, info } = await sharp(SOURCE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error("El logo no tiene píxeles visibles");
  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function main() {
  const box = await tightBox();
  /* El recorte apretado es la fuente de todo: el arte llena su lienzo. */
  const tight = await sharp(SOURCE).extract(box).png().toBuffer();
  const meta = await sharp(tight).metadata();
  console.log(
    `Logo recortado a su dibujo real: ${box.width}x${box.height} ` +
      `(desde ${meta.width}x${meta.height} del archivo original)`,
  );

  /* Contenido cuadrado: el dibujo es más alto que ancho, así que `contain`
     lo escala hasta tocar arriba y abajo, y el fondo que corresponda rellena
     los márgenes que quedan a los lados.

     `flatten` compone TODO el lienzo sobre el fondo, no solo el padding: el
     `resize` con `background` solo llena las bandas añadidas y el dibujo
     conserva su propia alfa (las esquinas de su caja son transparentes). Sin
     aplanar, iOS y Android pintan esas zonas con el fondo que les da la gana
     y el icono se ve como un cuadrado que no llena la teja. Con fondo
     transparente —el favicon— no se aplana: la transparencia es la gracia. */
  const contain = (size, background) =>
    sharp(tight)
      .resize(size, size, { fit: "contain", background: TRANSPARENT })
      .png();

  /* El dibujo (transparente, llenando su teja) compuesto sobre el cielo del
     hero: iOS no admite transparencia y el fondo del icono ya no puede ser un
     color plano — es el degradado de la landing. */
  const onHeroGlow = async (size) =>
    sharp(heroGlowSvg(size)).composite([
      {
        input: await contain(size, TRANSPARENT).toBuffer(),
        top: 0,
        left: 0,
        blend: "over",
      },
    ]);

  // ── src/app/icon.png ── favicon moderno y icono genérico (transparente).
  await contain(512, TRANSPARENT).toFile("src/app/icon.png");

  // ── src/app/apple-icon.png ── iOS no admite transparencia: el lienzo entero
  // va con el cielo del hero y el dibujo toca arriba y abajo del icono.
  const appleIcon = await onHeroGlow(180);
  await appleIcon.png().toFile("src/app/apple-icon.png");

  // ── public/icons/ ── los que nombra el manifest.
  mkdirSync("public/icons", { recursive: true });
  await contain(192, TRANSPARENT).toFile("public/icons/icon-192.png");
  await contain(512, TRANSPARENT).toFile("public/icons/icon-512.png");

  // Maskable: Android recorta un círculo hasta un 20% del borde, así que el
  // dibujo baja al 66% y el cielo llena todo el lienzo. Con el recorte
  // apretado, ese 66% es ahora arte de verdad y no aire.
  const maskSize = 512;
  const maskInner = Math.round(maskSize * 0.66);
  const maskContent = await sharp(tight)
    .resize(maskInner, maskInner, { fit: "contain", background: TRANSPARENT })
    .png()
    .toBuffer();
  await sharp(heroGlowSvg(maskSize))
    .composite([
      {
        input: maskContent,
        top: Math.floor((maskSize - maskInner) / 2),
        left: Math.floor((maskSize - maskInner) / 2),
        blend: "over",
      },
    ])
    .png()
    .toFile("public/icons/icon-512-maskable.png");

  // ── src/app/favicon.ico ── ICO contenedor con tres PNG (16/32/48). El
  // formato admite PNG embebido (Vista+) y así no hace falta una dependencia
  // solo para escribir ICO.
  const icoSizes = [16, 32, 48];
  const pngs = await Promise.all(
    icoSizes.map((s) => contain(s, TRANSPARENT).toBuffer()),
  );

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo 1 = icono
  header.writeUInt16LE(icoSizes.length, 4);

  const entries = [];
  const images = [];
  let offset = 6 + 16 * icoSizes.length;
  icoSizes.forEach((size, i) => {
    const png = pngs[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // ancho (0 = 256)
    entry.writeUInt8(size === 256 ? 0 : size, 1); // alto
    entry.writeUInt8(0, 2); // paleta: 0 = truecolor
    entry.writeUInt8(0, 3); // reservado
    entry.writeUInt16LE(1, 4); // planos
    entry.writeUInt16LE(32, 6); // bits por píxel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
    images.push(png);
  });

  writeFileSync("src/app/favicon.ico", Buffer.concat([header, ...entries, ...images]));

  console.log("Iconos generados desde", SOURCE, ":");
  console.log("  src/app/favicon.ico (16/32/48), src/app/icon.png (512),");
  console.log("  src/app/apple-icon.png (180), public/icons/ (192, 512, maskable)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
