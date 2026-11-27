import assert from "node:assert/strict";
import { test } from "node:test";
import type { FacturaResumen, PeriodoPago } from "./facturas";
import {
  contratoCompleto,
  datosContratoIniciales,
  htmlContrato,
  resolverTokens,
  type DatosContrato,
} from "./contrato";

const FACTURA: FacturaResumen = {
  id: "abc123",
  negocioId: "negocio-1",
  negocioNombre: "El Palmar",
  tipo: "pack_medida",
  packId: "pack-1",
  planClave: null,
  titulo: "Pack a medida — El Palmar",
  conceptos: [
    { nombre: "Menú Pro", detalle: ["Carta digital"] },
    { nombre: "Reservas y pedidos", detalle: ["Pedidos por WhatsApp"] },
  ],
  nota: null,
  notaAutor: null,
  precioUsd: 5,
  precioSeparadoUsd: 6,
  precioOriginalUsd: null,
  descuentoPct: null,
  oferta2x1: true,
  tasaCup: 1139,
  estado: "pagada",
  expiraEn: null,
  metodoPago: "qvapay",
  avisoPagoEn: null,
  numeroFactura: 42,
  pagoId: "pago-1",
  reembolso: null,
  enviadaEn: "2026-11-26T10:00:00.000Z",
  aceptadaEn: "2026-11-26T11:00:00.000Z",
  pagadaEn: "2026-11-27T12:00:00.000Z",
  canceladaEn: null,
  creadoEn: "2026-11-26T10:00:00.000Z",
};

const PERIODO: PeriodoPago = {
  inicio: "2026-11-27",
  fin: "2027-01-26",
  proximoCobro: "2027-01-27",
  meses: 2,
};

const DATOS: DatosContrato = {
  negocio: "El Palmar",
  titular: "Ana Pérez",
  servicios: "Menú Pro · Reservas y pedidos",
  fechaInicio: "27 de noviembre de 2026",
  precio: "5 USD",
  periodicidad: "Mensual",
  promocion: "2×1 del primer pago",
  canal: "WhatsApp del negocio",
  observaciones: "Instalación el lunes.",
  diasAtencion: "Lunes a viernes",
  horarioAtencion: "9:00 a. m. – 5:00 p. m. (hora de Cuba)",
  representante: "Ana Pérez",
  firma: "Ana Pérez",
  fechaFirma: "27 de noviembre de 2026",
};

test("los datos iniciales salen de la factura y su periodo", () => {
  const datos = datosContratoIniciales(FACTURA, PERIODO);
  assert.equal(datos.negocio, "El Palmar");
  assert.equal(datos.servicios, "Menú Pro · Reservas y pedidos");
  assert.equal(datos.precio, "5 USD");
  assert.equal(datos.fechaInicio, "27 de noviembre de 2026");
  assert.equal(datos.promocion, "2×1 del primer pago (segundo mes sin costo)");
  assert.equal(datos.titular, "");
});

test("sin titular, representante y firma el contrato no está completo", () => {
  assert.equal(contratoCompleto(DATOS), true);
  assert.equal(
    contratoCompleto({ ...DATOS, firma: " " }),
    false,
  );
  assert.equal(
    contratoCompleto({ ...DATOS, representante: "" }),
    false,
  );
});

test("los huecos de atención se sustituyen por lo escrito", () => {
  assert.equal(
    resolverTokens("Días: {{DIAS}} · Horario: {{HORARIO}}", DATOS),
    "Días: Lunes a viernes · Horario: 9:00 a. m. – 5:00 p. m. (hora de Cuba)",
  );
  assert.equal(
    resolverTokens("Días: {{DIAS}}", { ...DATOS, diasAtencion: "" }),
    "Días: [Completar días de atención]",
  );
});

test("el contrato descargado lleva datos, condiciones y factura", () => {
  const html = htmlContrato(FACTURA, DATOS, 5695);
  assert.match(html, /Contrato abc123/);
  assert.match(html, /El Palmar/);
  assert.match(html, /Ana Pérez/);
  assert.match(html, /Factura n.º 0042/);
  assert.match(html, /5 USD/);
  assert.match(html, /5\u202F695 CUP/);
  assert.match(html, /Lunes a viernes/);
  assert.match(html, /9:00 a\. m\. – 5:00 p\. m\./);
  assert.match(html, /laverdecuba@gmail\.com/);
  assert.match(html, /\+5355336238/);
  assert.match(html, /Política de reembolso/);
  assert.match(html, /Confirmación de recepción y aceptación/);
  assert.match(html, /window\.print\(\)/);
});

test("el HTML escapa lo que escribe el cliente", () => {
  const html = htmlContrato(
    FACTURA,
    { ...DATOS, observaciones: "<script>alert(1)</script>" },
    null,
  );
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
