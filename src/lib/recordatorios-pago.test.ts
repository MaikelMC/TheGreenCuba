import assert from "node:assert/strict";
import { test } from "node:test";
import { FUNCIONES, GRATIS, type Funcion } from "@/lib/plans";
import {
  avisoDePago,
  diasHastaPago,
  etapaDePago,
  sugerenciasParaProbar,
} from "@/lib/recordatorios-pago";

/**
 * El aviso del mes, sin base de datos ni reloj.
 *
 * Lo que se prueba es el calendario —los tres momentos y el hueco del día
 * exacto— y la redacción, porque el mismo texto sale por push y por correo: un
 * error aquí se multiplica por cada dueño de la app.
 */

const PAGO = new Date("2026-11-10T15:00:00Z");

function diasAntes(dias: number): Date {
  return new Date(PAGO.getTime() - dias * 86_400_000);
}

test("la cuenta de días es de calendario, no de horas", () => {
  assert.equal(diasHastaPago(PAGO, diasAntes(5)), 5);
  assert.equal(diasHastaPago(PAGO, diasAntes(1)), 1);
  assert.equal(diasHastaPago(PAGO, PAGO), 0);
  assert.equal(diasHastaPago(PAGO, new Date(PAGO.getTime() + 86_400_000)), -1);
});

test("un pago a las once de la noche sigue siendo de ese día", () => {
  /* 23:00 en La Habana del día 10 es la madrugada del 11 en UTC: contar por UTC
     adelantaría el aviso un día entero. */
  const tarde = new Date("2026-11-11T04:00:00Z");
  assert.equal(diasHastaPago(PAGO, tarde), 0);
});

test("cinco días antes, el día antes y el día siguiente al vencimiento", () => {
  assert.equal(etapaDePago(5), "proximo");
  assert.equal(etapaDePago(4), "proximo");
  assert.equal(etapaDePago(1), "vispera");
  assert.equal(etapaDePago(-1), "vencido");
});

test("el día del vencimiento no se avisa", () => {
  assert.equal(etapaDePago(0), null);
});

test("fuera de la ventana no se avisa: ni demasiado pronto ni para siempre", () => {
  assert.equal(etapaDePago(6), null);
  assert.equal(etapaDePago(-4), null);
});

test("el aviso de cinco días nombra la fecha y el precio", () => {
  const aviso = avisoDePago({
    negocio: "Panadería El Sol",
    plan: "Pro",
    precioUsd: 10,
    fechaPago: PAGO,
    etapa: "proximo",
    sugerencias: ["Menú Pro (1 USD/mes): productos ilimitados"],
    ahora: diasAntes(5),
  });

  assert.match(aviso.push.title, /en 5 días/);
  assert.match(aviso.saludo, /10 nov/);
  assert.match(aviso.saludo, /10 USD al mes/);
  assert.equal(aviso.sugerencias.length, 1);
});

test("la víspera dice que mañana es el último día", () => {
  const aviso = avisoDePago({
    negocio: "Panadería El Sol",
    plan: "Esencial",
    precioUsd: 3.5,
    fechaPago: PAGO,
    etapa: "vispera",
    sugerencias: [],
    ahora: diasAntes(1),
  });

  assert.match(aviso.push.title, /Mañana/);
  assert.match(aviso.saludo, /mañana/);
});

test("el aviso de vencido dice que no se renovó y que se puede reactivar", () => {
  const aviso = avisoDePago({
    negocio: "Panadería El Sol",
    plan: "Pro",
    precioUsd: 10,
    fechaPago: PAGO,
    etapa: "vencido",
    sugerencias: ["Facebook ×3 (3 USD/mes): 3 publicaciones por semana"],
    ahora: new Date(PAGO.getTime() + 86_400_000),
  });

  assert.match(aviso.asunto, /no se renovó/);
  assert.match(aviso.saludo, /venció el/);
  assert.match(aviso.ctaTexto, /Reactivar/);
  /* Nada se pierde: el texto tiene que decirlo, o el dueño cree que borró su carta. */
  assert.ok(aviso.parrafos.some((p) => p.includes("No se perdió nada")));
});

test("las sugerencias no proponen lo que el negocio ya tiene", () => {
  /* Un negocio en Gratis: el Menú Pro es lo primero que le falta. */
  const gratis = sugerenciasParaProbar(new Set());
  assert.ok(gratis.length > 0);
  assert.match(gratis[0] ?? "", /Menú Pro/);

  /* Uno que ya tiene todo el catálogo no recibe sugerencias. */
  const todo = new Set(Object.keys(FUNCIONES) as Funcion[]);
  const ninguna = sugerenciasParaProbar(todo);
  assert.equal(ninguna.length, 0);

  /* Y quien tiene lo de Gratis no recibe algo que ya viene en Gratis. */
  const conGratis = sugerenciasParaProbar(new Set(GRATIS));
  assert.ok(conGratis.every((s) => !s.includes("Búsquedas con IA")));
});
