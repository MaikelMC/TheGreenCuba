import assert from "node:assert/strict";
import { test } from "node:test";
import { canViewDevPlace, ownsDevPlace } from "@/lib/dev-place";

/**
 * El negocio de prueba se confunde fácil con una cuestión de visibilidad, y no
 * lo es: `canViewDevPlace` dice si se puede **ver** aquí —en desarrollo, sí,
 * para cualquiera— y `ownsDevPlace` dice si es **tuyo**, que no depende del
 * entorno. Este test fija la segunda, que es la que decide quién lo lleva en el
 * panel y quién puede escribirlo.
 *
 * Se puede importar `dev-place` a secas porque la sesión se importa dentro de
 * `mayViewDevPlace`: este módulo no arrastra la base ni Neon al cargarse.
 */

test("el dueño del negocio de prueba es la cuenta autorizada", () => {
  assert.equal(ownsDevPlace("maikelcanario0@gmail.com"), true);
});

test("el correo del dueño se normaliza antes de comparar", () => {
  assert.equal(ownsDevPlace("  MaikelCanario0@Gmail.COM  "), true);
});

test("otra cuenta no es dueña del negocio de prueba", () => {
  assert.equal(ownsDevPlace("michelcnry01@gmail.com"), false);
});

test("sin sesión no hay dueño", () => {
  assert.equal(ownsDevPlace(null), false);
  assert.equal(ownsDevPlace(undefined), false);
  assert.equal(ownsDevPlace(""), false);
});

test("el dueño es exactamente la lista, y nadie más", () => {
  for (const email of [
    "dev@local",
    "admin@laverde.cu",
    "kinarycyberdev@gmail.com",
    "maikelcanario0@gmail.co",
    "maikelcanario0@gmail.com ",
  ]) {
    /* El último lleva un espacio al final, que la normalización recorta: es el
       único de la lista que sí es dueño, y comprueba que la igualdad es por
       correo entero y no por prefijo. */
    assert.equal(
      ownsDevPlace(email),
      email.trim() === "maikelcanario0@gmail.com",
      `inesperado para: ${JSON.stringify(email)}`,
    );
  }
});

test("ser dueño implica poder verlo", () => {
  /* Al revés no: en desarrollo `canViewDevPlace` dice que sí a cualquiera, y es
     justo la confusión que hacía que el fixture saliera en paneles ajenos. */
  assert.equal(canViewDevPlace("maikelcanario0@gmail.com"), true);
});
