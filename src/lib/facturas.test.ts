import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOGO } from "./plans";
import {
  DIAS_VALIDEZ_PROPIOS,
  diasValidezDesde,
  conceptosDePack,
  dependenciasSinCumplir,
  normalizarConcepto,
  esMetodoPago,
  formatoCup,
  formatoUsd,
  lineaTasa,
  mensajeTransferenciaCup,
  usdACup,
  estadoEfectivo,
  fechaHavanaISO,
  periodoDePago,
  precioSeparado,
  sumarMesesISO,
} from "./facturas";

test("una propuesta pendiente pasa a caducada al servir la página", () => {
  const ahora = new Date("2026-11-26T12:00:00Z");
  assert.equal(
    estadoEfectivo("pendiente", "2026-11-27T00:00:00.000Z", ahora),
    "pendiente",
  );
  assert.equal(
    estadoEfectivo("pendiente", "2026-11-25T00:00:00.000Z", ahora),
    "caducada",
  );
});

test("solo caduca la pendiente: una aceptada sigue esperando el pago", () => {
  const ahora = new Date("2026-11-26T12:00:00Z");
  assert.equal(
    estadoEfectivo("aceptada", "2026-11-25T00:00:00.000Z", ahora),
    "aceptada",
  );
  assert.equal(estadoEfectivo("pagada", null, ahora), "pagada");
  assert.equal(estadoEfectivo("pendiente", null, ahora), "pendiente");
});

test("la validez es 7 días por defecto y no se rompe con valores inválidos", () => {
  assert.equal(DIAS_VALIDEZ_PROPIOS, 7);
  assert.equal(diasValidezDesde(undefined), 7);
  assert.equal(diasValidezDesde("10"), 10);
  assert.equal(diasValidezDesde("0"), 7);
  assert.equal(diasValidezDesde("-3"), 7);
  assert.equal(diasValidezDesde("abc"), 7);
  assert.equal(diasValidezDesde("366"), 7);
});

test("la fecha de La Habana manda sobre el huso del servidor", () => {
  /* 03:00 UTC del 27 todavía es el 26 por la noche en La Habana. */
  assert.equal(
    fechaHavanaISO(new Date("2026-11-27T03:00:00Z")),
    "2026-11-26",
  );
});

test("el 2×1 cubre dos meses y el siguiente cobro cae al mismo día", () => {
  const periodo = periodoDePago(new Date("2026-11-27T03:00:00Z"), true);
  assert.deepEqual(periodo, {
    inicio: "2026-11-26",
    fin: "2027-01-25",
    proximoCobro: "2027-01-26",
    meses: 2,
  });
});

test("sin 2×1 el periodo es de un mes", () => {
  const periodo = periodoDePago(new Date("2026-11-27T03:00:00Z"), false);
  assert.equal(periodo.meses, 1);
  assert.equal(periodo.proximoCobro, "2026-12-26");
  assert.equal(periodo.fin, "2026-12-25");
});

test("sumar meses respeta el fin de mes", () => {
  assert.equal(sumarMesesISO("2027-01-31", 1), "2027-02-28");
  assert.equal(sumarMesesISO("2026-11-30", 2), "2027-01-30");
  assert.equal(sumarMesesISO("malformada", 1), "malformada");
});

test("el precio por separado suma los módulos y no cuenta dos veces Menú Pro", () => {
  assert.equal(precioSeparado(["menu_pro"], CATALOGO), 1);
  assert.equal(precioSeparado(["menu_pro", "pedidos_reservas"], CATALOGO), 1.5);
  assert.equal(
    precioSeparado(
      ["pedidos_reservas", "pedidos_programados", "cliente_frecuente"],
      CATALOGO,
    ),
    4,
  );
  assert.equal(precioSeparado(["no_existe"], CATALOGO), null);
});

test("los métodos de pago se validan", () => {
  assert.equal(esMetodoPago("qvapay"), true);
  assert.equal(esMetodoPago("transferencia"), true);
  assert.equal(esMetodoPago("efectivo"), true);
  assert.equal(esMetodoPago("paypal"), false);
  assert.equal(esMetodoPago(null), false);
});

test("USD sin decimales si es entero y con dos y coma si no", () => {
  assert.equal(formatoUsd(5), "5");
  assert.equal(formatoUsd(3.5), "3,50");
  assert.equal(formatoUsd(1200), "1\u202F200");
});

test("CUP redondeado a pesos, con espacio fino y nunca con decimales", () => {
  assert.equal(formatoCup(5695.832), "5\u202F696");
  assert.equal(formatoCup(780), "780");
  assert.equal(formatoCup(1234567.4), "1\u202F234\u202F567");
  assert.equal(usdACup(5, 1139.1664), 5696);
});

test("la línea de la tasa lleva la fecha antes de pagar y «aplicada» después", () => {
  const fecha = new Date("2026-11-26T20:00:00Z");
  assert.equal(lineaTasa(1139, fecha), "Tasa del 26 nov: 1\u202F139 CUP por USD");
  assert.equal(lineaTasa(1139, fecha, true), "Tasa aplicada: 1\u202F139 CUP por USD");
});

test("los módulos llevan beneficio y los flyers solo van en «Próximamente»", () => {
  const [facebook] = conceptosDePack(["facebook"], CATALOGO);
  assert.ok(facebook?.beneficio);
  assert.ok(facebook.detalle.every((l) => !/flyer|pr[oó]ximamente/i.test(l)));
  assert.deepEqual(facebook.proximamente, [CATALOGO.funciones.flyers.texto]);
});

test("la dependencia es una nota, no una línea, y solo si va incluida", () => {
  const conceptos = conceptosDePack(
    ["pedidos_reservas", "pedidos_programados"],
    CATALOGO,
  );
  const programados = conceptos[1];
  assert.ok(programados?.detalle.every((l) => !/requiere/i.test(l)));
  assert.equal(
    programados?.nota,
    "Funciona junto con Reservas y pedidos (incluido).",
  );
  assert.equal(conceptos[0]?.nota, "Incluye todo lo de Menú Pro.");
});

test("una propuesta con una dependencia sin cumplir no se emite", () => {
  assert.equal(dependenciasSinCumplir(["cliente_frecuente"], CATALOGO).length, 1);
  assert.deepEqual(
    dependenciasSinCumplir(["pedidos_reservas", "cliente_frecuente"], CATALOGO),
    [],
  );
  /* Un pack estándar que trae los pedidos también la cumple. */
  assert.deepEqual(
    dependenciasSinCumplir(["esencial", "pedidos_programados"], CATALOGO),
    [],
  );
});

test("las propuestas antiguas se leen sin «Requiere» ni «(próximamente)»", () => {
  const limpio = normalizarConcepto({
    nombre: "Reservas y pedidos",
    detalle: [
      "Todo el Menú Pro",
      "Flujo de pedidos",
      "Generar flyers publicitarios (próximamente)",
      "Requiere el módulo Reservas y pedidos",
    ],
  });
  assert.deepEqual(limpio.detalle, ["Flujo de pedidos"]);
  assert.equal(limpio.nota, "Incluye todo lo de Menú Pro.");
  assert.deepEqual(limpio.proximamente, ["Generar flyers publicitarios"]);
});

test("el mensaje de transferencia lleva el detalle para verificar la factura", () => {
  const mensaje = mensajeTransferenciaCup({
    id: "abc123",
    negocioNombre: "El Palmar",
    precioUsd: 5,
    cup: 5696,
    enlace: "https://laverde.kynari.dev/factura/abc123",
    fecha: "26 nov 2026, 2:30 p. m.",
  });

  assert.match(mensaje, /Factura: abc123/);
  assert.match(mensaje, /Negocio: El Palmar/);
  assert.match(mensaje, /Importe: 5 USD \(≈ 5\u202F696 CUP\)/);
  assert.match(mensaje, /Fecha: 26 nov 2026/);
  assert.match(mensaje, /https:\/\/laverde\.kynari\.dev\/factura\/abc123/);
  assert.match(mensaje, /confirman que esta factura es real/i);
  assert.match(mensaje, /tarjeta, titular e importe exacto en CUP/);
});
