import { test } from "node:test";
import assert from "node:assert/strict";

import {
  detectarPlataforma,
  normalizarPlataforma,
} from "./plataforma";

test("Android y tablet Android van a android", () => {
  assert.equal(
    detectarPlataforma({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile" }).plataforma,
    "android",
  );
  assert.equal(
    detectarPlataforma({ userAgent: "Mozilla/5.0 (Linux; Android 13; SM-X700)" }).detalle,
    "Tablet Android",
  );
});

test("iPadOS que se presenta como Mac se reconoce por los toques", () => {
  const resultado = detectarPlataforma({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    platform: "MacIntel",
    maxTouchPoints: 5,
  });
  assert.equal(resultado.plataforma, "ios");
  assert.equal(resultado.detalle, "iPadOS");
});

test("HarmonyOS y KaiOS no se disfrazan de escritorio", () => {
  assert.equal(
    detectarPlataforma({ userAgent: "Mozilla/5.0 (Linux; HarmonyOS 4)" }).plataforma,
    "otros",
  );
  assert.equal(
    detectarPlataforma({ userAgent: "Mozilla/5.0 (Mobile; rv:48.0) Gecko/48.0 Firefox/48.0 KaiOS/2.5" }).plataforma,
    "otros",
  );
});

test("los bots se marcan para excluirlos de las sesiones", () => {
  const resultado = detectarPlataforma({
    userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  });
  assert.equal(resultado.bot, true);
  assert.equal(resultado.plataforma, "otros");
});

test("normalizarPlataforma manda lo desconocido a otros", () => {
  assert.equal(normalizarPlataforma("android"), "android");
  assert.equal(normalizarPlataforma("ios"), "ios");
  assert.equal(normalizarPlataforma("escritorio"), "escritorio");
  assert.equal(normalizarPlataforma("bot"), "otros");
  assert.equal(normalizarPlataforma(undefined), "otros");
});
