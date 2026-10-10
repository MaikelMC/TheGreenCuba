import assert from "node:assert/strict";
import { test } from "node:test";
import {
  construirPromptPublicacion,
  esEstadoPublicacion,
  normalizarVariantes,
  perfilDesdePlace,
  planearEdicionPublicacion,
  semanaDe,
  validarContenidoPublicacion,
  validarEnlacePublicado,
  MAX_TEXTO,
} from "./publicaciones";
import type { UserPlace } from "./places-store";

const HORA = 3_600_000;
const AHORA = new Date("2026-10-08T12:00:00Z").getTime();

function place(extra: Partial<UserPlace> = {}): UserPlace {
  return {
    id: "neg1",
    slug: "neg1",
    name: "Café La Ceiba",
    category: "Cafetería",
    lat: 0,
    lng: 0,
    address: "",
    barrio: "",
    description: "Café de especialidad",
    schedule: "",
    payments: [],
    menu: [],
    offer: null,
    status: "active",
    pedidosWhatsapp: true,
    isActive: true,
    reviewStatus: "approved",
    isBoosted: false,
    boostExpiresAt: "",
    createdAt: 0,
    ...extra,
  };
}

/* ── Semana ISO ─────────────────────────────────────────────────────────────
   El 1 de enero de 2026 es jueves, así que la semana 1 empieza el lunes 29 de
   diciembre de 2025. Es justo el caso que rompe el cálculo ingenuo —«semana =
   días / 7 del año natural»— y por eso las pruebas lo fijan. */

test("la semana ISO se ancla al jueves, no al año natural", () => {
  assert.equal(semanaDe(new Date("2026-01-01T00:00:00Z")), "2026-W01");
  /* Lunes de esa semana: ya es la 1 de 2026 aunque sea de 2025. */
  assert.equal(semanaDe(new Date("2025-12-29T12:00:00Z")), "2026-W01");
  /* El domingo que la cierra sigue en la misma, y el lunes siguiente ya no. */
  assert.equal(semanaDe(new Date("2026-01-04T23:00:00Z")), "2026-W01");
  assert.equal(semanaDe(new Date("2026-01-05T00:00:00Z")), "2026-W02");
});

test("la misma semana da la misma clave de lunes a domingo", () => {
  const lunes = semanaDe(new Date("2026-10-05T12:00:00Z"));
  const viernes = semanaDe(new Date("2026-10-09T12:00:00Z"));
  const domingo = semanaDe(new Date("2026-10-11T23:59:00Z"));
  assert.equal(lunes, "2026-W41");
  assert.equal(viernes, lunes);
  assert.equal(domingo, lunes);
});

test("la clave se escribe con dos dígitos y no toca la fecha que recibe", () => {
  assert.equal(semanaDe(new Date("2026-03-02T00:00:00Z")), "2026-W10");
  const fecha = new Date("2026-10-11T18:00:00Z");
  const antes = fecha.getTime();
  semanaDe(fecha);
  assert.equal(fecha.getTime(), antes);
});

/* ── Validación ───────────────────────────────────────────────────────────── */

test("el contenido se recorta y la imagen es opcional", () => {
  assert.deepEqual(validarContenidoPublicacion({ texto: "  Hola  " }), {
    texto: "Hola",
    imagenUrl: null,
  });
  assert.deepEqual(
    validarContenidoPublicacion({
      texto: "Hola",
      imagenUrl: " https://cdn.test/flyer.png ",
    }),
    { texto: "Hola", imagenUrl: "https://cdn.test/flyer.png" },
  );
});

test("sin texto, con una imagen que no es URL o demasiado largo: error", () => {
  assert.equal(typeof validarContenidoPublicacion({ texto: "   " }), "string");
  assert.equal(typeof validarContenidoPublicacion({}), "string");
  assert.equal(
    typeof validarContenidoPublicacion("no soy un objeto"),
    "string",
  );
  /* La imagen se pide http(s) porque el navegador la va a descargar. */
  assert.equal(
    typeof validarContenidoPublicacion({
      texto: "Hola",
      imagenUrl: "javascript:alert(1)",
    }),
    "string",
  );
  assert.equal(
    typeof validarContenidoPublicacion({ texto: "x".repeat(MAX_TEXTO + 1) }),
    "string",
  );
});

test("publicar exige un enlace http(s)", () => {
  assert.equal(
    validarEnlacePublicado("https://facebook.com/groups/1/posts/2"),
    "https://facebook.com/groups/1/posts/2",
  );
  assert.equal(
    validarEnlacePublicado("  https://x.test/1  "),
    "https://x.test/1",
  );
  assert.equal(validarEnlacePublicado(""), false);
  assert.equal(validarEnlacePublicado("javascript:alert(1)"), false);
  assert.equal(validarEnlacePublicado(null), false);
  assert.equal(validarEnlacePublicado(undefined), false);
});

/* ── Edición de la cola ───────────────────────────────────────────────────── */

const LISTA = {
  texto: "Hola",
  imagenUrl: null,
  estado: "lista" as const,
  enlace: null,
};
const PUBLICADA = {
  texto: "Hola",
  imagenUrl: null,
  estado: "publicada" as const,
  enlace: "https://fb.test/1",
};

test("publicar exige el enlace y sella la fecha", () => {
  /* Sin enlace no se marca: el posteo es manual, así que el estado es una
     afirmación que hay que poder comprobar. */
  assert.equal(
    typeof planearEdicionPublicacion(LISTA, { estado: "publicada" }),
    "string",
  );
  assert.deepEqual(
    planearEdicionPublicacion(LISTA, {
      estado: "publicada",
      enlace: "https://fb.test/1",
    }),
    { estado: "publicada", enlace: "https://fb.test/1", publicadaEn: true },
  );
});

test("volver atrás deshace el registro", () => {
  assert.deepEqual(
    planearEdicionPublicacion(PUBLICADA, { estado: "borrador" }),
    {
      estado: "borrador",
      enlace: null,
      publicadaEn: false,
    },
  );
});

test("corregir el enlace de una publicada no toca el estado", () => {
  assert.deepEqual(
    planearEdicionPublicacion(PUBLICADA, { enlace: "https://fb.test/2" }),
    { enlace: "https://fb.test/2" },
  );
  /* En una que no está publicada, un enlace suelto no significa nada. */
  assert.deepEqual(
    planearEdicionPublicacion(LISTA, { enlace: "https://fb.test/2" }),
    {},
  );
  assert.equal(
    typeof planearEdicionPublicacion(PUBLICADA, { enlace: "" }),
    "string",
  );
});

test("editar solo la imagen no exige tocar el texto, pero borrar el texto no cuela", () => {
  assert.deepEqual(
    planearEdicionPublicacion(LISTA, { imagenUrl: "https://cdn.test/f.png" }),
    { texto: "Hola", imagenUrl: "https://cdn.test/f.png" },
  );
  assert.equal(
    typeof planearEdicionPublicacion(LISTA, { texto: "   " }),
    "string",
  );
  assert.equal(
    typeof planearEdicionPublicacion(LISTA, { estado: "enviada" }),
    "string",
  );
  /* Sin llaves no hay cambio: la ruta lo responde con un 400. */
  assert.deepEqual(planearEdicionPublicacion(LISTA, {}), {});
});

test("solo los tres estados valen", () => {
  assert.equal(esEstadoPublicacion("borrador"), true);
  assert.equal(esEstadoPublicacion("lista"), true);
  assert.equal(esEstadoPublicacion("publicada"), true);
  assert.equal(esEstadoPublicacion("enviada"), false);
  assert.equal(esEstadoPublicacion(3), false);
});

/* ── Variantes del modelo ─────────────────────────────────────────────────── */

test("de la salida del modelo se quedan hasta dos variantes limpias", () => {
  assert.deepEqual(normalizarVariantes([" uno ", "dos", "tres"]), [
    "uno",
    "dos",
  ]);
  assert.deepEqual(normalizarVariantes("una sola"), ["una sola"]);
  /* Vacías y no-cadenas se caen, y no ocupan plaza. */
  assert.deepEqual(normalizarVariantes(["  ", 7, "buena"]), ["buena"]);
  assert.deepEqual(normalizarVariantes(undefined), []);
  assert.deepEqual(normalizarVariantes({ variantes: ["x"] }), []);
});

/* ── Perfil y prompt ──────────────────────────────────────────────────────── */

test("al modelo solo van las ofertas vigentes y el enlace del perfil", () => {
  const perfil = perfilDesdePlace(
    place({
      city: "Santiago de Cuba",
      menu: [
        { name: "Cortado", description: "", price: "120", currency: "CUP" },
        { name: "Cheesecake", description: "", price: "350", currency: "CUP" },
      ],
      ofertas: [
        {
          id: "o1",
          productoId: "p1",
          titulo: "2x1 en cortados",
          descuentoPct: 50,
          inicia: AHORA - HORA,
          termina: AHORA + HORA,
        },
        {
          id: "o2",
          productoId: "p2",
          titulo: "Caducada",
          precioOferta: "100",
          inicia: AHORA - 2 * HORA,
          termina: AHORA - HORA,
        },
      ],
    }),
    "https://laverde.test/",
    AHORA,
  );

  assert.equal(perfil.enlacePerfil, "https://laverde.test/place/neg1");
  assert.equal(perfil.productos.length, 2);
  assert.deepEqual(perfil.productos[0], { nombre: "Cortado", precio: "120" });
  /* La caducada no entra, y la rebaja se resume para el modelo. */
  assert.deepEqual(perfil.ofertas, [
    { titulo: "2x1 en cortados", rebaja: "50% menos" },
  ]);
});

test("la carta que viaja al modelo está acotada", () => {
  const menu = Array.from({ length: 20 }, (_, i) => ({
    name: `Producto ${i + 1}`,
    description: "",
    price: "10",
    currency: "CUP",
  }));
  const perfil = perfilDesdePlace(
    place({ menu }),
    "https://laverde.test",
    AHORA,
  );
  assert.equal(perfil.productos.length, 8);
});

test("el prompt pide JSON, dos variantes y el enlace exacto", () => {
  const perfil = perfilDesdePlace(place(), "https://laverde.test", AHORA);
  const { system, user } = construirPromptPublicacion(perfil);

  assert.match(system, /variantes/);
  assert.match(system, /JSON/);
  assert.match(system, /DOS variantes/);
  /* Los datos del negocio y la llamada a la acción van en el mensaje de usuario. */
  assert.match(user, /Café La Ceiba/);
  assert.match(user, /https:\/\/laverde\.test\/place\/neg1/);
});
