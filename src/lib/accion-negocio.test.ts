import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accionPrincipalNegocio,
  etiquetaAccionPrincipal,
  type DatosAccionNegocio,
} from "@/lib/accion-negocio";

function negocio(extra: Partial<DatosAccionNegocio> = {}): DatosAccionNegocio {
  return {
    pedidosHabilitado: false,
    domicilio: false,
    whatsapp: null,
    reservaHabilitada: false,
    tipoReserva: null,
    ...extra,
  };
}

test("un negocio con pedidos abre «Pedir»", () => {
  const accion = accionPrincipalNegocio(negocio({ pedidosHabilitado: true }));
  assert.equal(accion, "pedir");
  assert.equal(etiquetaAccionPrincipal(accion), "Pedir");
});

test("un negocio a domicilio con WhatsApp también abre «Pedir»", () => {
  const accion = accionPrincipalNegocio(
    negocio({ domicilio: true, whatsapp: "+5355555555" }),
  );
  assert.equal(accion, "pedir");
});

test("sin pedidos pero con cita abre «Pedir cita»", () => {
  const accion = accionPrincipalNegocio(
    negocio({ reservaHabilitada: true, tipoReserva: "cita" }),
  );
  assert.equal(accion, "pedir-cita");
  assert.equal(etiquetaAccionPrincipal(accion), "Pedir cita");
});

test("una reserva de mesa no se confunde con una cita", () => {
  const accion = accionPrincipalNegocio(
    negocio({ reservaHabilitada: true, tipoReserva: "mesa" }),
  );
  assert.equal(accion, "como-llegar");
});

test("un negocio sin pedidos ni citas abre «Cómo llegar»", () => {
  const accion = accionPrincipalNegocio(negocio());
  assert.equal(accion, "como-llegar");
  assert.equal(etiquetaAccionPrincipal(accion), "Cómo llegar");
});
