import { test } from "node:test";
import assert from "node:assert/strict";

import {
  aplicarAccionMapa,
  ESTADO_MAPA_INICIAL,
  type AccionMapa,
  type EstadoMapa,
} from "./mapa";

function secuencia(acciones: AccionMapa[]): string[] {
  let estado: EstadoMapa = ESTADO_MAPA_INICIAL;
  const eventos: string[] = [];
  for (const accion of acciones) {
    const resultado = aplicarAccionMapa(estado, accion);
    estado = resultado.estado;
    eventos.push(...resultado.eventos.map((evento) => evento.tipo));
  }
  return eventos;
}

test("una carga correcta emite inicio y carga, una sola vez", () => {
  assert.deepEqual(
    secuencia([
      { tipo: "inicio" },
      { tipo: "cargado", ms: 1200 },
      { tipo: "cargado", ms: 1500 },
      { tipo: "abandonado", ms: 2000 },
    ]),
    ["mapa_inicio", "mapa_cargado"],
  );
});

test("una carga lenta emite carga y lentitud", () => {
  assert.deepEqual(
    secuencia([
      { tipo: "inicio" },
      { tipo: "cargado", ms: 9000 },
    ]),
    ["mapa_inicio", "mapa_cargado", "mapa_lento"],
  );
});

test("un error no se convierte en abandono", () => {
  assert.deepEqual(
    secuencia([
      { tipo: "inicio" },
      { tipo: "error", motivo: "sin_webgl" },
      { tipo: "abandonado", ms: 800 },
    ]),
    ["mapa_inicio", "mapa_error"],
  );
});

test("abandonar antes de cargar se registra una vez", () => {
  assert.deepEqual(
    secuencia([
      { tipo: "inicio" },
      { tipo: "abandonado", ms: 500 },
      { tipo: "abandonado", ms: 900 },
      { tipo: "cargado", ms: 1200 },
    ]),
    ["mapa_inicio", "mapa_abandonado"],
  );
});

test("el error de WebGL conserva el motivo corto", () => {
  const resultado = aplicarAccionMapa(ESTADO_MAPA_INICIAL, {
    tipo: "error",
    motivo: "sin_webgl",
  });
  assert.deepEqual(resultado.eventos[0]?.datos, { motivo: "sin_webgl" });
});
