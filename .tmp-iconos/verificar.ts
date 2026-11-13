import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { esTamanoIcono, margenIcono, pngIconoCuadrado } from "../src/lib/tarjeta-icono";

async function main() {
const kynari = await readFile("Logos/kynari-logo.png");

/* Logo sintético: cuadrado blanco con un bloque rojo pequeño en el centro. */
const bloque = await sharp({
  create: { width: 100, height: 100, channels: 3, background: { r: 220, g: 20, b: 20 } },
})
  .png()
  .toBuffer();
const conRelleno = await sharp({
  create: { width: 300, height: 300, channels: 3, background: { r: 255, g: 255, b: 255 } },
})
  .composite([{ input: bloque, top: 100, left: 100 }])
  .png()
  .toBuffer();

for (const [nombre, fuente, lado, maskable] of [
  ["kynari-180", kynari, 180, false],
  ["kynari-192", kynari, 192, false],
  ["kynari-512", kynari, 512, false],
  ["kynari-512-maskable", kynari, 512, true],
  ["relleno-512", conRelleno, 512, false],
] as const) {
  const png = await pngIconoCuadrado(fuente, lado, { margen: margenIcono(maskable) });
  const meta = await sharp(png).metadata();
  const { isOpaque } = await sharp(png).stats();
  await writeFile(`.tmp-iconos/${nombre}.png`, png);
  console.log(
    nombre,
    `${meta.width}x${meta.height}`,
    meta.format,
    "canales=" + meta.channels,
    "opaco=" + isOpaque,
  );
}

/* Esquinas del icono con relleno: si el trim + cover funcionan, el rojo llega
   hasta el borde y no queda ni un píxel blanco. */
const esquina = await sharp(".tmp-iconos/relleno-512.png")
  .extract({ left: 2, top: 2, width: 4, height: 4 })
  .raw()
  .toBuffer();
console.log("esquina relleno:", [...new Set(Array.from(esquina))]);
console.log("es tamano 180:", esTamanoIcono(180), "200:", esTamanoIcono(200));
}

void main();
