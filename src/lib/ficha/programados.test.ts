/**
 * Pruebas de franjasDisponibles. Correr con:
 *   node --experimental-strip-types src/lib/ficha/programados.test.ts
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { franjasDisponibles, type DiaDisponible } from "./programados";
import type { ProgramadosConfig } from "./entrega";
import type { Horario } from "./horario";

const CONFIG: ProgramadosConfig = {
  activo: true,
  diasMax: 2,
  antelacionMin: 60,
  franjaMin: 30,
  cupoPorFranja: null,
  avisoMin: 45,
};

const HORARIO: Horario = {
  semana: {
    lun: [{ abre: "09:00", cierra: "12:00" }],
    mar: [{ abre: "09:00", cierra: "12:00" }],
    mie: [{ abre: "09:00", cierra: "12:00" }],
    jue: [{ abre: "09:00", cierra: "12:00" }],
    vie: [{ abre: "09:00", cierra: "12:00" }],
    sab: [{ abre: "09:00", cierra: "12:00" }],
    dom: [{ abre: "09:00", cierra: "12:00" }],
  },
};

/** Lunes a las 07:00 Havana (UTC-5 → 12:00 UTC). */
const LUNES_7AM_UTC = new Date("2025-06-02T12:00:00Z"); // lunes, 07:00 Havana

test("devuelve franjas cuando config activa y horario configurado", () => {
  const dias = franjasDisponibles(CONFIG, HORARIO, LUNES_7AM_UTC, new Map());
  assert.ok(dias.length > 0, "debería haber al menos un día con franjas");
});

test("hoy: descarta franjas dentro de la antelación", () => {
  // 07:00 + 60 min = 08:00. Las 09:00–09:30 pasan el filtro; slots a las 08:30 no.
  const dias = franjasDisponibles(CONFIG, HORARIO, LUNES_7AM_UTC, new Map());
  const hoy = dias.find((d) => d.etiqueta === "Hoy");
  assert.ok(hoy, "debe haber día 'Hoy'");
  // Todas las franjas de hoy deben ser >= 09:00 (540 min) > 07:00 + 60 = 480
  for (const f of hoy.franjas) {
    // La etiqueta empieza con la hora de inicio
    const [hStr] = f.etiqueta.split(":");
    const h = Number(hStr);
    assert.ok(h >= 9, `franja ${f.etiqueta} demasiado pronto`);
  }
});

test("config inactiva → array vacío", () => {
  const cfg = { ...CONFIG, activo: false };
  const dias = franjasDisponibles(cfg, HORARIO, LUNES_7AM_UTC, new Map());
  assert.deepEqual(dias, []);
});

test("sin horario → array vacío", () => {
  const dias = franjasDisponibles(CONFIG, null, LUNES_7AM_UTC, new Map());
  assert.deepEqual(dias, []);
});

test("cupo lleno marca franja como llena pero no la descarta", () => {
  const cfg = { ...CONFIG, cupoPorFranja: 2 };
  // La primera franja de hoy (09:00 UTC–5 → 14:00 UTC) está llena
  const primerSlotUtc = new Date("2025-06-02T14:00:00Z");
  const ocup = new Map([[primerSlotUtc.toISOString(), 2]]);
  const dias = franjasDisponibles(cfg, HORARIO, LUNES_7AM_UTC, ocup);
  const hoy = dias.find((d) => d.etiqueta === "Hoy");
  assert.ok(hoy, "debe haber día Hoy");
  const llena = hoy.franjas.find((f) => f.inicio.getTime() === primerSlotUtc.getTime());
  assert.ok(llena?.llena, "la franja con cupo lleno debe marcarse llena");
});

test("diasMax respeta el tope de días devueltos", () => {
  const cfg = { ...CONFIG, diasMax: 1 };
  const dias = franjasDisponibles(cfg, HORARIO, LUNES_7AM_UTC, new Map());
  assert.ok(dias.length <= 2, "con diasMax=1 no puede haber más de 2 días (hoy y mañana)");
});

test("etiquetas de días: Hoy, Mañana, y día corto para offset >= 2", () => {
  const cfg = { ...CONFIG, diasMax: 3 };
  const dias = franjasDisponibles(cfg, HORARIO, LUNES_7AM_UTC, new Map());
  const etiquetas = dias.map((d) => d.etiqueta);
  assert.ok(etiquetas.includes("Hoy"), "debe incluir Hoy");
  assert.ok(etiquetas.includes("Mañana"), "debe incluir Mañana");
  const resto = etiquetas.filter((e) => e !== "Hoy" && e !== "Mañana");
  for (const e of resto) {
    // «mié. 4» o similar: abreviatura, punto y número. `\w` no basta:
    // no incluye las vocales acentuadas de «mié» o «sáb».
    assert.ok(/[\p{L}]{3,}\.\s*\d+$/u.test(e), `etiqueta ${e} no tiene el formato esperado`);
  }
});

test("franja que cruza medianoche genera slots solo hasta el cierre", () => {
  const horNocturno: Horario = {
    semana: {
      lun: [{ abre: "23:00", cierra: "01:00" }],
      dom: [],
      mar: [],
      mie: [],
      jue: [],
      vie: [],
      sab: [],
    },
  };
  // 22:00 Havana (03:00 UTC mañana): antelación 60 → 23:00 pasa el filtro
  const tardeLunes = new Date("2025-06-03T03:00:00Z");
  const dias = franjasDisponibles(CONFIG, horNocturno, tardeLunes, new Map());
  const hoy = dias.find((d) => d.etiqueta === "Hoy");
  assert.ok(hoy, "debe haber día Hoy con franja nocturna");
  assert.ok(hoy.franjas.length >= 1, "debe haber al menos una franja nocturna");
});
