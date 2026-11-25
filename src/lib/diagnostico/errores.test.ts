import { test } from "node:test";
import assert from "node:assert/strict";

import {
  agruparErrores,
  limpiarDatosDiagnostico,
  limpiarMensaje,
  normalizarError,
} from "./errores";

test("limpiarMensaje quita query, correo, teléfono e id", () => {
  const limpio = limpiarMensaje(
    "Error en https://laverde.cu/place/1?email=ana@example.com&tel=5351234567 correo ana@example.com tel 5351234567 id 550e8400-e29b-41d4-a716-446655440000",
  );
  assert.equal(limpio.includes("ana@example.com"), false);
  assert.equal(limpio.includes("5351234567"), false);
  assert.equal(limpio.includes("550e8400"), false);
  assert.equal(limpio.includes("?email="), false);
});

test("la versión del SW no se confunde con un teléfono al limpiar contexto", () => {
  const limpio = limpiarDatosDiagnostico({
    swVersion: "lv-2026-11-23-21-42-45",
    mensaje: "tel 5351234567",
  }) as Record<string, string>;
  assert.equal(limpio.swVersion, "lv-2026-11-23-21-42-45");
  assert.equal(limpio.mensaje?.includes("5351234567"), false);
});

test("React #418 y Hydration failed caen en el mismo grupo", () => {
  assert.equal(normalizarError("Minified React error #418").clave, "react-418");
  assert.equal(normalizarError("Hydration failed because...").clave, "react-418");
  assert.equal(normalizarError("Minified React error #418").severidad, "alta");
});

test("Script error queda aparte y con severidad baja", () => {
  const normalizado = normalizarError("Script error.");
  assert.equal(normalizado.clave, "script-externo");
  assert.equal(normalizado.severidad, "baja");
});

test("IndexedDB se agrupa como error alto", () => {
  const normalizado = normalizarError(
    "UnhandledRejection: Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.",
  );
  assert.equal(normalizado.clave, "indexeddb");
  assert.equal(normalizado.severidad, "alta");
});

test("agruparErrores cuenta casos, sesiones y ejemplos", () => {
  const grupos = agruparErrores([
    {
      id: "1",
      datos: {
        mensaje: "Minified React error #418",
        sesion: "s1",
        plataforma: "android",
        ruta: "/place/1?x=1",
      },
      creadoEn: "2026-11-01T10:00:00.000Z",
    },
    {
      id: "2",
      datos: {
        mensaje: "Hydration failed because...",
        sesion: "s1",
        plataforma: "ios",
        ruta: "/place/2",
      },
      creadoEn: "2026-11-02T10:00:00.000Z",
    },
    {
      id: "3",
      datos: { mensaje: "Script error.", sesion: "s2", plataforma: "android" },
      creadoEn: "2026-11-03T10:00:00.000Z",
    },
  ]);

  assert.equal(grupos[0]?.clave, "react-418");
  assert.equal(grupos[0]?.casos, 2);
  assert.equal(grupos[0]?.sesiones, 1);
  assert.equal(grupos[0]?.rutas.includes("/place/1"), true);
  assert.equal(grupos[1]?.severidad, "baja");
});
