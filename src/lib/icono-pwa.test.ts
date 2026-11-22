import assert from "node:assert/strict";
import { test } from "node:test";

import sharp from "sharp";

import { iconoDelNegocio, insigniaMenuSvg } from "./icono-pwa";

/**
 * La insignia de la carta existe para que su icono no se confunda con el de la
 * tarjeta de sellos del mismo negocio. Lo que se prueba aquí es lo que rompe
 * esa promesa: un PNG con transparencia (iOS lo pinta negro), un tamaño que no
 * es el que pide el manifiesto y una insignia que no se pinta.
 */

test("la insignia normal cabe en el icono, en la esquina inferior derecha", () => {
  const svg = insigniaMenuSvg(512, false).toString("utf8");
  assert.match(svg, /width="512" height="512"/);
  /* El disco no se sale del lienzo: centro + radio ≤ lado. */
  const circulos = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)];
  assert.equal(circulos.length, 2, "aro y disco");
  for (const [, cx, cy, r] of circulos) {
    assert.ok(Number(cx) + Number(r) <= 512);
    assert.ok(Number(cy) + Number(r) <= 512);
  }
});

test("la insignia maskable vive dentro del círculo seguro de Android", () => {
  const svg = insigniaMenuSvg(512, true).toString("utf8");
  const [, cx, cy, r] =
    [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].at(-1) ?? [];
  const centro = 256;
  const distancia = Math.hypot(Number(cx) - centro, Number(cy) - centro);
  /* Zona segura: un círculo de diámetro 80 % del lado (radio 204,8). */
  assert.ok(distancia + Number(r) <= 512 * 0.4);
});

test("sin logo se sirve el icono de reserva, en PNG opaco y al tamaño pedido", async () => {
  const png = await iconoDelNegocio(null, 512, { insignia: "menu" });
  assert.ok(png, "el icono de reserva tiene que existir");

  const { width, height, channels, hasAlpha } = await sharp(png).metadata();
  assert.deepEqual({ width, height, hasAlpha }, { width: 512, height: 512, hasAlpha: false });
  assert.ok(channels === undefined || channels <= 4);
});

test("la insignia cambia el icono: con ella no es igual que sin ella", async () => {
  const limpio = await iconoDelNegocio(null, 180);
  const marcado = await iconoDelNegocio(null, 180, { insignia: "menu" });
  assert.ok(limpio && marcado);
  assert.notDeepEqual(limpio, marcado);
  assert.equal((await sharp(marcado).metadata()).width, 180);
});
