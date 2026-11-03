import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accionDisponible,
  resolverAcciones,
  resolverBarra,
  resolverFila,
} from "@/lib/ficha/acciones";

const CON_TODO = {
  telefono: "+5355000000",
  whatsapp: "+5355000000",
  enlaceSeguidores: "https://t.me/bot?start=abc",
  pedidosHabilitado: true,
  reservaHabilitada: true,
  tipoReserva: "mesa" as const,
};

const SIN_NADA = {};

test("sin el dato, la acción no se ofrece", () => {
  assert.equal(accionDisponible("llamar", SIN_NADA), false);
  assert.equal(accionDisponible("whatsapp", SIN_NADA), false);
  assert.equal(accionDisponible("ofertas", SIN_NADA), false);
  assert.equal(accionDisponible("pedir", SIN_NADA), false);
});

test("guardar, compartir y cómo llegar no dependen de datos del negocio", () => {
  assert.equal(accionDisponible("guardar", SIN_NADA), true);
  assert.equal(accionDisponible("compartir", SIN_NADA), true);
  assert.equal(accionDisponible("como_llegar", SIN_NADA), true);
});

test("la fila se filtra, no se repite y se corta en cuatro", () => {
  const fila = resolverFila(
    ["como_llegar", "llamar", "whatsapp", "llamar", "ofertas", "compartir"],
    CON_TODO,
  );
  assert.deepEqual(fila, ["como_llegar", "llamar", "whatsapp", "ofertas"]);
});

test("una ficha sin configuración no inventa acciones", () => {
  assert.deepEqual(resolverFila(null, CON_TODO), []);
  assert.deepEqual(resolverBarra(undefined, CON_TODO), []);
  assert.deepEqual(resolverAcciones(null, CON_TODO), { fila: [], barra: [] });
});

test("la barra nunca pinta una función de pago sin habilitar", () => {
  assert.deepEqual(resolverBarra(["pedir", "reservar"], SIN_NADA), []);
  assert.deepEqual(resolverBarra(["pedir", "reservar"], CON_TODO), [
    "pedir",
    "reservar",
  ]);
});

test("reservar, apartar y cita dependen del tipo configurado", () => {
  const datos = { ...CON_TODO, tipoReserva: "apartado" as const };
  assert.deepEqual(resolverBarra(["reservar", "apartar", "cita"], datos), [
    "apartar",
  ]);
});
