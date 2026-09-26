/**
 * Genera todos los iconos del sitio a partir de `public/logo.png` — el logo
 * que ya usa el sitio en cabeceras, landing y splash. Ninguna imagen nueva:
 * este script solo lo reescala y lo acomoda en los formatos que pide cada
 * contexto (pestaña del navegador, pantalla de inicio de iOS/Android).
 *
 * Salidas:
 *  - src/app/favicon.ico            16/32/48 en un solo ICO → pestaña y marcadores
 *  - src/app/icon.png               512×512 transparente    → icono moderno
 *  - src/app/apple-icon.png         180×180 fondo arena     → iOS (no admite alfa)
 *  - public/icons/icon-192.png      manifest any
 *  - public/icons/icon-512.png      manifest any
 *  - public/icons/icon-512-maskable.png  manifest maskable (logo al 66% sobre arena)
 *
 * Uso: `node scripts/generate-icons.mjs` — correr de nuevo si cambia el logo.
 * `sharp` ya viene con Next (`next build` lo usa para optimizar imágenes).
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const SOURCE = "public/logo.png";
const SAND = { r: 246, g: 243, b: 236, alpha: 1 }; // #F6F3EC, el fondo claro del sitio
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function main() {
  const logo = sharp(SOURCE);
  const meta = await logo.metadata();
  if (!meta.width || !meta.height) throw new Error("No pude leer el logo");

  // Contenido cuadrado: el logo (256×267) entra con `contain` y el resto es
  // margen del color de fondo que toque.
  const contain = (size, background) =>
    sharp(SOURCE)
      .resize(size, size, { fit: "contain", background })
      .png();

  // ── src/app/icon.png ── favicon moderno y icono genérico (transparente).
  await contain(512, TRANSPARENT).toFile("src/app/icon.png");

  // ── src/app/apple-icon.png ── iOS compone negro detrás del alfa, así que el
  // fondo va lleno de arena, con margen sobrado alrededor del logo.
  const appleSize = 180;
  const appleInner = 150;
  await sharp(SOURCE)
    .resize(appleInner, appleInner, { fit: "contain", background: TRANSPARENT })
    .extend({
      top: (appleSize - appleInner) / 2,
      bottom: (appleSize - appleInner) / 2,
      left: (appleSize - appleInner) / 2,
      right: (appleSize - appleInner) / 2,
      background: SAND,
    })
    .png()
    .toFile("src/app/apple-icon.png");

  // ── public/icons/ ── los que nombra el manifest.
  mkdirSync("public/icons", { recursive: true });
  await contain(192, TRANSPARENT).toFile("public/icons/icon-192.png");
  await contain(512, TRANSPARENT).toFile("public/icons/icon-512.png");

  // Maskable: Android recorta un círculo hasta un 20% del borde, así que el
  // logo baja al 66% y el fondo llena todo el lienzo.
  const maskInner = Math.round(512 * 0.66);
  await sharp(SOURCE)
    .resize(maskInner, maskInner, { fit: "contain", background: TRANSPARENT })
    .extend({
      top: (512 - maskInner) / 2,
      bottom: (512 - maskInner) / 2,
      left: (512 - maskInner) / 2,
      right: (512 - maskInner) / 2,
      background: SAND,
    })
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

  console.log("Iconos generados desde", SOURCE, `(${meta.width}x${meta.height}):`);
  console.log("  src/app/favicon.ico (16/32/48), src/app/icon.png (512),");
  console.log("  src/app/apple-icon.png (180), public/icons/ (192, 512, maskable)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
