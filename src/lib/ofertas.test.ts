import assert from "node:assert/strict";
import { test } from "node:test";
import {
  estaVigente,
  hayOferta,
  inicioValido,
  ofertaDe,
  ofertasVigentes,
  parsePrecio,
  precioConOferta,
  precioRebajado,
  validarOferta,
} from "./ofertas";
import type { UserPlaceOferta } from "./places-store";

const AHORA = new Date("2026-10-08T12:00:00").getTime();
const HORA = 3_600_000;

function oferta(extra: Partial<UserPlaceOferta> = {}): UserPlaceOferta {
  return {
    id: "o1",
    productoId: "p1",
    titulo: "2x1",
    inicia: AHORA - HORA,
    termina: AHORA + HORA,
    ...extra,
  };
}

test("viva: ni antes de empezar ni al llegar el final", () => {
  assert.equal(estaVigente(oferta(), AHORA), true);
  /* El principio es inclusivo y el final exclusivo. */
  assert.equal(estaVigente(oferta({ inicia: AHORA }), AHORA), true);
  assert.equal(estaVigente(oferta({ termina: AHORA }), AHORA), false);
  assert.equal(estaVigente(oferta({ inicia: AHORA + 1 }), AHORA), false);
});

test("las caducadas no salen, y la que antes caduca va delante", () => {
  const vieja = oferta({ id: "vieja", termina: AHORA - 1 });
  const tarde = oferta({ id: "tarde", termina: AHORA + 2 * HORA });
  const pronto = oferta({ id: "pronto", termina: AHORA + HORA });

  const vivas = ofertasVigentes([vieja, tarde, pronto], AHORA);
  assert.deepEqual(vivas.map((o) => o.id), ["pronto", "tarde"]);
  assert.equal(hayOferta([vieja], AHORA), false);
  assert.equal(hayOferta(undefined, AHORA), false);
  assert.equal(hayOferta([vieja, pronto], AHORA), true);
});

test("la oferta de un producto es la suya, y solo si está viva", () => {
  const otra = oferta({ id: "otra", productoId: "p2" });
  const mia = oferta({ id: "mia", productoId: "p1" });
  assert.equal(ofertaDe([otra, mia], "p1", AHORA)?.id, "mia");
  assert.equal(ofertaDe([otra], "p1", AHORA), undefined);
  assert.equal(ofertaDe([oferta({ productoId: "p1", termina: AHORA - 1 })], "p1", AHORA), undefined);
});

test("un precio de texto libre solo cuenta si es una cifra entera", () => {
  assert.equal(parsePrecio("150"), 150);
  assert.equal(parsePrecio(" 2.50 "), 2.5);
  assert.equal(parsePrecio("3,50"), 3.5);
  assert.equal(parsePrecio(""), null);
  /* La trampa que justifica no usar `parseFloat`: el rango daría 3. */
  assert.equal(parsePrecio("3–5 USD"), null);
  assert.equal(parsePrecio("Desde 8"), null);
});

test("porcentaje sobre la carta", () => {
  const diez = oferta({ descuentoPct: 10 });
  assert.deepEqual(precioConOferta("150", diez), { de: "150", por: "135" });
  assert.equal(precioRebajado(2.5, 50), 1.25);
  /* Sin cifra que tachar no se pinta nada, en vez de inventarse un precio. */
  assert.equal(precioConOferta("3–5 USD", diez), null);
});

test("precio rebajado escrito a mano: se enseña tal cual", () => {
  assert.deepEqual(precioConOferta("150", oferta({ precioOferta: "100" })), {
    de: "150",
    por: "100",
  });
});

test("no se empieza en el pasado, pero una oferta en curso se deja editar", () => {
  /* El minuto en curso vale —es el que el `<input type="datetime-local">` acaba
     de proponer—; el anterior ya no. De ahí el redondeo al minuto. */
  assert.equal(inicioValido("2026-10-08T12:00", "", AHORA), true);
  assert.equal(inicioValido("2026-10-08T12:01", "", AHORA), true);
  assert.equal(inicioValido("2026-10-08T11:59", "", AHORA), false);
  /* La que ya empezó se reabre sin moverle la hora; adelantarla al pasado no. */
  assert.equal(inicioValido("2026-10-08T09:00", "2026-10-08T09:00", AHORA), true);
  assert.equal(inicioValido("2026-10-08T09:00", "", AHORA), false);
  /* Vacío no es asunto de esta función: de eso avisa `validarOferta`. */
  assert.equal(inicioValido("", "", AHORA), true);
});

test("lo que llega del navegador se comprueba antes de guardarlo", () => {
  const bien = { ...oferta({ descuentoPct: 20 }), inicia: AHORA, termina: AHORA + 1 };
  assert.equal(typeof validarOferta(bien), "object");
  /* El título y el producto se recortan; la descripción vacía es «no hay». */
  const recortada = validarOferta({ ...bien, titulo: "  2x1  ", productoId: " p1 ", descripcion: "  " });
  assert.equal(typeof recortada === "string" ? "" : recortada.titulo, "2x1");
  assert.equal(typeof recortada === "string" ? "" : recortada.descripcion, undefined);

  const errores = [
    { ...bien, titulo: "  " },
    { ...bien, productoId: "" },
    { ...bien, termina: bien.inicia },
    /* Las dos rebajas a la vez, y ninguna: los dos casos que el `check` de la
       tabla rechazaría con un 500. */
    { ...bien, precioOferta: "100" },
    { ...oferta({}), descuentoPct: undefined },
    { ...bien, descuentoPct: 0 },
    { ...bien, descuentoPct: 150 },
    "no soy una oferta",
  ];
  for (const entrada of errores) {
    assert.equal(typeof validarOferta(entrada), "string", `deberia fallar: ${JSON.stringify(entrada)}`);
  }
});
