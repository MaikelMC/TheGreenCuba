import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FUNCIONES,
  GRATIS,
  MODULOS,
  PACKS,
  PACKS_ORDER,
  PLAN_ORDER,
  PRECIO_MENSUAL,
  cupDe,
  enTrial,
  funcionesDe,
  limiteDe,
  packDe,
  planEfectivo,
  textoBloqueo,
  trialHastaDesde,
  type Funcion,
  type ModuloContratado,
  type Plan,
  type Suscripcion,
} from "./plans";

const AHORA = new Date("2026-10-08T12:00:00Z");
const AYER = new Date("2026-10-07T12:00:00Z");
const MANANA = new Date("2026-10-09T12:00:00Z");

function susc(parcial: Partial<Suscripcion> = {}): Suscripcion {
  return {
    plan: "gratis",
    estado: "activa",
    trialHasta: null,
    venceEn: null,
    modulos: [],
    ...parcial,
  };
}

function modulo(clave: ModuloContratado["clave"], hasta: Date | null = null) {
  return { clave, desde: AYER, hasta } satisfies ModuloContratado;
}

test("sin fila de suscripción el plan es gratis", () => {
  assert.equal(planEfectivo(null, AHORA), "gratis");
  assert.ok(GRATIS.every((f) => funcionesDe(null, AHORA).has(f)));
});

test("la prueba viva vale Pro entero, aunque no haya pack", () => {
  const s = susc({ trialHasta: MANANA });
  assert.equal(planEfectivo(s, AHORA), "pro");
  assert.equal(enTrial(s, AHORA), true);
  for (const f of PACKS.pro.funciones) {
    assert.ok(funcionesDe(s, AHORA).has(f), `pro de prueba sin ${f}`);
  }
});

test("la prueba vencida no deja nada: se cae al pack contratado", () => {
  assert.equal(planEfectivo(susc({ trialHasta: AYER }), AHORA), "gratis");
  assert.equal(
    planEfectivo(susc({ plan: "esencial", trialHasta: AYER }), AHORA),
    "esencial",
  );
  assert.equal(enTrial(susc({ trialHasta: AYER }), AHORA), false);
});

test("cancelar corta en el acto, aunque queden días de prueba o de pago", () => {
  const s = susc({
    plan: "pro",
    estado: "cancelada",
    trialHasta: MANANA,
    venceEn: MANANA,
    modulos: [modulo("menu_pro")],
  });
  assert.equal(planEfectivo(s, AHORA), "gratis");
  assert.ok(!funcionesDe(s, AHORA).has("qr_sin_marca"));
});

test("un pack de pago sin fecha no vence; pasado de fecha cae a gratis", () => {
  assert.equal(planEfectivo(susc({ plan: "pro" }), AHORA), "pro");
  assert.equal(planEfectivo(susc({ plan: "pro", venceEn: AYER }), AHORA), "gratis");
  assert.equal(planEfectivo(susc({ plan: "esencial", venceEn: AYER }), AHORA), "gratis");
  assert.equal(planEfectivo(susc({ plan: "pro", venceEn: MANANA }), AHORA), "pro");
});

test("la prueba dura 30 días", () => {
  const hasta = trialHastaDesde(AHORA);
  assert.equal(hasta.getTime() - AHORA.getTime(), 30 * 86_400_000);
});

test("un módulo suelto vale por sí solo, sin pack", () => {
  const s = susc({ modulos: [modulo("menu_pro")] });
  const funciones = funcionesDe(s, AHORA);
  assert.ok(funciones.has("qr_sin_marca"));
  assert.ok(funciones.has("fotos_ilimitadas"));
  assert.equal(planEfectivo(s, AHORA), "gratis");
});

test("el módulo suelto se suma al pack, no lo sustituye", () => {
  const funciones = funcionesDe(
    susc({ plan: "esencial", modulos: [modulo("asistente_telegram")] }),
    AHORA,
  );
  assert.ok(funciones.has("qr_sin_marca"), "se perdió lo del pack");
  assert.ok(funciones.has("asistente_ia"), "se perdió el módulo suelto");
});

test("un módulo vencido no da nada, pero el pack sigue vivo", () => {
  const funciones = funcionesDe(
    susc({ plan: "esencial", modulos: [modulo("asistente_telegram", AYER)] }),
    AHORA,
  );
  assert.ok(!funciones.has("asistente_ia"));
  assert.ok(funciones.has("qr_sin_marca"));
});

test("un pack y un módulo no se excluyen entre sí", () => {
  const funciones = funcionesDe(susc({ plan: "pro", modulos: [modulo("facebook")] }), AHORA);
  assert.ok(funciones.has("ofertas_flash"), "se perdió lo de Esencial");
  assert.ok(funciones.has("publicaciones_fb"));
});

test("cada pack trae todo lo de Gratis, y Pro lo de los otros dos", () => {
  const de = (p: Plan) => funcionesDe(susc({ plan: p }), AHORA);

  for (const p of PACKS_ORDER) {
    for (const f of GRATIS) assert.ok(de(p).has(f), `${p} sin ${f}`);
  }
  for (const p of ["esencial", "publicidad_max"] as const) {
    for (const f of PACKS[p].funciones) assert.ok(de("pro").has(f), `pro sin ${f}`);
  }
  /* Publicidad Max no arrastra Esencial: solo suma lo suyo a Gratis. */
  assert.ok(!de("gratis").has("eventos"));
  assert.ok(!de("esencial").has("eventos"));
  assert.ok(de("publicidad_max").has("eventos"));
  assert.ok(!de("publicidad_max").has("qr_sin_marca"));
});

/* Lo que vende cada pack, clavado. Si se toca un pack sin querer, salta aquí. */
test("cada pack trae exactamente sus extras sobre Gratis", () => {
  const orden = (fs: readonly Funcion[]) => [...fs].sort();
  assert.deepEqual(orden(PACKS.esencial.funciones), [
    "fotos_ilimitadas",
    /* Se sumó a propósito: el Menú Pro del que sale Esencial ahora concede
       `hoy_hay`, y un pack que nombra sus funciones tiene que repetirlo. */
    "hoy_hay",
    "ofertas_flash",
    "publicaciones_fb",
    "qr_sin_marca",
    "reservas_whatsapp",
    "seguidores",
    "whatsapp_pedido",
  ]);
  assert.deepEqual(orden(PACKS.publicidad_max.funciones), [
    "eventos",
    "publicaciones_fb",
    "publicaciones_fb_3",
    "seguidores",
  ]);
  assert.deepEqual(orden(PACKS.pro.funciones), [
    "asistente_ia",
    "eventos",
    "fotos_ilimitadas",
    "hoy_hay",
    "ofertas_flash",
    "publicaciones_fb",
    "publicaciones_fb_3",
    "qr_sin_marca",
    "reservas_whatsapp",
    "seguidores",
    "whatsapp_pedido",
  ]);
});

/* Si esto se rompe, las tarjetas mienten: enseñarían una función que no trae el
   pack, o el candado nombraría una vía que no la abre. */
test("lo que anuncia cada pieza está en sus funciones, y al revés", () => {
  for (const modulo of Object.values(MODULOS)) {
    for (const f of modulo.funciones) {
      assert.ok(FUNCIONES[f], `${modulo.nombre} nombra una función que no existe`);
    }
  }
  for (const pack of Object.values(PACKS)) {
    for (const f of pack.funciones) {
      assert.ok(FUNCIONES[f], `${pack.nombre} nombra una función que no existe`);
    }
  }
});

/* Un pack más caro que otro y que traiga menos no se nota en el código: se nota
   en la tarjeta, y para entonces ya está publicado. */
test("los precios suben con el plan y el gratis es cero", () => {
  assert.equal(PRECIO_MENSUAL.gratis, 0);
  const pagos = PLAN_ORDER.filter((p) => p !== "gratis");
  for (let i = 1; i < pagos.length; i++) {
    const caro = pagos[i]!;
    const barato = pagos[i - 1]!;
    assert.ok(
      PRECIO_MENSUAL[caro] > PRECIO_MENSUAL[barato],
      `${caro} no es más caro que ${barato}`,
    );
  }
});

test("el CUP sale de la tasa, redondeado a la decena", () => {
  assert.equal(cupDe(1), 780);
  assert.equal(cupDe(1.5), 1170);
  assert.equal(cupDe(3.5), 2730);
  assert.equal(cupDe(10), 7800);
});

test("el candado nombra la vía más barata que abre la función", () => {
  /* Gratis ya la trae: no hay candado. */
  assert.equal(textoBloqueo("menu_qr"), "No disponible");
  /* Suelta: el módulo, por nombre. */
  assert.equal(textoBloqueo("qr_sin_marca"), "Está en Menú Pro");
  assert.equal(textoBloqueo("reservas_whatsapp"), "Está en Reservas y pedidos");
  assert.equal(textoBloqueo("asistente_ia"), "Está en Agente de Telegram");
  /* Todavía no existe: se vende, pero el candado lo dice. */
  assert.equal(textoBloqueo("eventos"), "Próximamente");
});

test("el tope de publicaciones distingue el módulo suelto del ×3", () => {
  assert.equal(limiteDe(funcionesDe(null, AHORA), "publicaciones_semana"), 0);
  assert.equal(
    limiteDe(funcionesDe(susc({ modulos: [modulo("facebook")] }), AHORA), "publicaciones_semana"),
    1,
  );
  assert.equal(
    limiteDe(funcionesDe(susc({ modulos: [modulo("facebook_3")] }), AHORA), "publicaciones_semana"),
    3,
  );
  assert.equal(
    limiteDe(funcionesDe(susc({ plan: "publicidad_max" }), AHORA), "publicaciones_semana"),
    3,
  );
});

test("los topes del catálogo y las fotos", () => {
  const gratis = funcionesDe(null, AHORA);
  assert.equal(limiteDe(gratis, "productos_max"), 15);
  assert.equal(limiteDe(gratis, "fotos_productos_max"), 10);

  const conMenuPro = funcionesDe(susc({ modulos: [modulo("menu_pro")] }), AHORA);
  assert.equal(limiteDe(conMenuPro, "productos_max"), null, "menú Pro sin fotos ilimitadas");
  assert.equal(limiteDe(conMenuPro, "fotos_productos_max"), null);
});

test("el pack más barato que abre una función, para nombrarlo", () => {
  assert.equal(packDe("menu_qr"), null, "menu_qr ya es de Gratis");
  assert.equal(packDe("publicaciones_fb"), "esencial");
  assert.equal(packDe("publicaciones_fb_3"), "publicidad_max");
  assert.equal(packDe("asistente_ia"), "pro");
});
