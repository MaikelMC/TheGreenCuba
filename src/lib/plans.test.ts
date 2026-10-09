import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FEATURES_POR_PLAN,
  FEATURES_QUE_ANADE,
  LIMITES,
  PLAN_ORDER,
  PRECIO_MENSUAL,
  enTrial,
  incluye,
  limiteDe,
  planDeFeature,
  planEfectivo,
  textoBloqueo,
  trialHastaDesde,
  type Suscripcion,
} from "./plans";

const AHORA = new Date("2026-10-08T12:00:00Z");
const AYER = new Date("2026-10-07T12:00:00Z");
const MANANA = new Date("2026-10-09T12:00:00Z");

function susc(parcial: Partial<Suscripcion>): Suscripcion {
  return {
    plan: "gratis",
    estado: "activa",
    trialHasta: null,
    venceEn: null,
    ...parcial,
  };
}

test("sin fila de suscripción el plan es gratis", () => {
  assert.equal(planEfectivo(null, AHORA), "gratis");
});

test("la prueba viva vale Pro aunque el plan contratado sea gratis", () => {
  const s = susc({ plan: "gratis", trialHasta: MANANA });
  assert.equal(planEfectivo(s, AHORA), "pro");
  assert.equal(enTrial(s, AHORA), true);
});

test("la prueba vencida no deja nada: se cae al plan contratado", () => {
  assert.equal(
    planEfectivo(susc({ plan: "gratis", trialHasta: AYER }), AHORA),
    "gratis",
  );
  assert.equal(
    planEfectivo(susc({ plan: "basico", trialHasta: AYER }), AHORA),
    "basico",
  );
  assert.equal(enTrial(susc({ trialHasta: AYER }), AHORA), false);
});

test("cancelar corta en el acto, aunque queden días de prueba o de pago", () => {
  const s = susc({
    plan: "pro",
    estado: "cancelada",
    trialHasta: MANANA,
    venceEn: MANANA,
  });
  assert.equal(planEfectivo(s, AHORA), "gratis");
});

test("un plan de pago sin fecha no vence", () => {
  assert.equal(planEfectivo(susc({ plan: "pro" }), AHORA), "pro");
});

test("un plan de pago pasado de fecha cae a gratis", () => {
  assert.equal(
    planEfectivo(susc({ plan: "pro", venceEn: AYER }), AHORA),
    "gratis",
  );
  assert.equal(
    planEfectivo(susc({ plan: "basico", venceEn: AYER }), AHORA),
    "gratis",
  );
  assert.equal(
    planEfectivo(susc({ plan: "pro", venceEn: MANANA }), AHORA),
    "pro",
  );
});

test("la prueba dura 30 días", () => {
  const hasta = trialHastaDesde(AHORA);
  assert.equal(hasta.getTime() - AHORA.getTime(), 30 * 86_400_000);
});

test("cada plan incluye todo lo del anterior", () => {
  for (const feature of FEATURES_POR_PLAN.gratis) {
    assert.ok(incluye("basico", feature), `básico sin ${feature}`);
    assert.ok(incluye("pro", feature), `pro sin ${feature}`);
  }
  for (const feature of FEATURES_POR_PLAN.basico) {
    assert.ok(incluye("pro", feature), `pro sin ${feature}`);
  }
  assert.ok(!incluye("gratis", "flyers"));
  assert.ok(incluye("pro", "flyers"));
});

/* Si esto se rompe, las tarjetas mienten: enseñarían una función como «lo que
   añade Pro» cuando en realidad ya venía en Gratis, o no la enseñarían nunca.
   El reparto tiene que cubrir el catálogo entero y sin repetir. */
test("lo que añade cada plan reparte el catálogo: nada repetido, nada perdido", () => {
  const repartido = PLAN_ORDER.flatMap((plan) => [...FEATURES_QUE_ANADE[plan]]);
  assert.deepEqual(repartido, [...FEATURES_POR_PLAN.pro]);
  assert.equal(new Set(repartido).size, repartido.length);
});

/* Un plan de arriba más barato que el de abajo no se nota en el código: se nota
   en la tarjeta, y para entonces ya está publicado. */
test("los precios suben con el plan y el gratis es cero", () => {
  assert.equal(PRECIO_MENSUAL.gratis, 0);
  assert.ok(PRECIO_MENSUAL.basico > PRECIO_MENSUAL.gratis);
  assert.ok(PRECIO_MENSUAL.pro > PRECIO_MENSUAL.basico);
});

test("el candado nombra el plan que abre la función", () => {
  assert.equal(planDeFeature("menu_qr"), "gratis");
  assert.equal(planDeFeature("prioridad_ia"), "basico");
  assert.equal(planDeFeature("flyers"), "pro");

  assert.equal(textoBloqueo("flyers", "gratis"), "Disponible en Pro");
  assert.equal(textoBloqueo("prioridad_ia", "gratis"), "Disponible en Básico");
  assert.equal(textoBloqueo("prioridad_ia", "basico"), null);
  assert.equal(textoBloqueo("menu_qr", "pro"), null);
});

test("los límites tienen un valor para cada plan", () => {
  for (const clave of Object.keys(LIMITES) as (keyof typeof LIMITES)[]) {
    for (const plan of PLAN_ORDER) {
      const tope = limiteDe(plan, clave);
      assert.ok(
        tope === null || typeof tope === "number",
        `${clave} sin valor para ${plan}`,
      );
    }
  }
});

test("los topes de los planes de pago son los acordados", () => {
  assert.equal(limiteDe("gratis", "productos_max"), 80);
  assert.equal(limiteDe("basico", "productos_max"), null);
  assert.equal(limiteDe("pro", "productos_max"), null);
  assert.equal(limiteDe("gratis", "fotos_productos_max"), 10);
  assert.equal(limiteDe("basico", "fotos_productos_max"), null);
  assert.equal(limiteDe("basico", "publicaciones_semana"), 1);
  assert.equal(limiteDe("pro", "publicaciones_semana"), 3);
  assert.equal(limiteDe("pro", "flyers_mes"), 10);
  assert.equal(limiteDe("pro", "ofertas_vigentes_max"), 3);
});
