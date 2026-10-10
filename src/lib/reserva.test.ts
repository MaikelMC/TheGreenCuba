import assert from "node:assert/strict";
import { test } from "node:test";
import {
  avisoCupo,
  configReserva,
  DIAS_MAX_RESERVA,
  errorFechaReserva,
  fechaLocalIso,
  formatearFechaReserva,
  hrefReserva,
  mensajeReserva,
  plantillaEfectiva,
  PLANTILLA_POR_DEFECTO,
  validarReserva,
  type DatosReserva,
} from "./reserva";

/** 15 de octubre de 2026, 00:00 local. La base para comparar fechas. */
const HOY = new Date(2026, 9, 15);

const datos = (extra: Partial<DatosReserva> = {}): DatosReserva => ({
  nombre: "Ana",
  fecha: "2026-10-20",
  hora: "20:00",
  ...extra,
});

test("la fecha se escribe en palabras, sin depender del locale", () => {
  assert.equal(formatearFechaReserva("2026-10-15"), "15 de octubre, 2026");
  assert.equal(formatearFechaReserva("2026-01-02"), "2 de enero, 2026");
  assert.equal(formatearFechaReserva("2026-12-31"), "31 de diciembre, 2026");
  /* Lo que no es una fecha se deja tal cual en vez de inventar un mes. */
  assert.equal(formatearFechaReserva("mañana"), "mañana");
});

test("sin plantilla propia se usa la del tipo; con ella, la del dueño", () => {
  assert.equal(plantillaEfectiva("mesa"), PLANTILLA_POR_DEFECTO.mesa);
  assert.equal(plantillaEfectiva("cita", "  "), PLANTILLA_POR_DEFECTO.cita);
  assert.equal(plantillaEfectiva("apartado", "Reserva {nombre}"), "Reserva {nombre}");
});

test("la fecha pasada no vale", () => {
  assert.match(
    validarReserva(datos({ fecha: "2026-10-14" }), "mesa", HOY) ?? "",
    /pasado/,
  );
  /* Hoy sí vale: es el límite, no el día siguiente. */
  assert.equal(validarReserva(datos({ fecha: "2026-10-15" }), "cita", HOY), null);
});

test("más de 30 días de antelación tampoco", () => {
  assert.equal(
    validarReserva(datos({ fecha: "2026-11-14" }), "cita", HOY),
    null,
  );
  assert.match(
    validarReserva(datos({ fecha: "2026-11-15" }), "cita", HOY) ?? "",
    /30 días/,
  );
  assert.equal(DIAS_MAX_RESERVA, 30);
});

test("una fecha imposible se rechaza en vez de rodar al mes siguiente", () => {
  assert.match(
    validarReserva(datos({ fecha: "2026-02-31" }), "cita", HOY) ?? "",
    /fecha/,
  );
});

test("nombre y hora son obligatorios", () => {
  assert.equal(validarReserva(datos({ nombre: "  " }), "cita", HOY), "Escribe tu nombre.");
  assert.equal(validarReserva(datos({ hora: "" }), "cita", HOY), "Elige la hora.");
  assert.equal(validarReserva(datos({ fecha: "" }), "cita", HOY), "Elige la fecha de la reserva.");
});

test("la mesa pide personas y respeta el aforo", () => {
  assert.equal(
    validarReserva(datos({ personas: 0 }), "mesa", HOY),
    "¿Para cuántas personas?",
  );
  assert.equal(validarReserva(datos({ personas: 4 }), "mesa", HOY), null);
  assert.match(
    validarReserva(datos({ personas: 9 }), "mesa", HOY, 8) ?? "",
    /hasta 8 personas/,
  );
  /* Sin aforo —`null`— no hay tope. */
  assert.equal(validarReserva(datos({ personas: 40 }), "mesa", HOY, null), null);
});

test("el apartado pide producto y cantidad; la cita no pide ninguna de las dos", () => {
  assert.equal(
    validarReserva(datos(), "apartado", HOY),
    "Elige qué quieres apartar.",
  );
  assert.equal(
    validarReserva(datos({ producto: "Tarta" }), "apartado", HOY),
    "¿Cuántos quieres apartar?",
  );
  assert.equal(
    validarReserva(datos({ producto: "Tarta", cantidad: 2 }), "apartado", HOY),
    null,
  );
  assert.equal(validarReserva(datos(), "cita", HOY), null);
});

test("el mensaje lleva la plantilla rellena, la nota y el cierre de La Verde", () => {
  const texto = mensajeReserva({
    negocio: "El Sabroso",
    tipo: "mesa",
    plantilla: null,
    datos: datos({ personas: 4, nota: "Vamos con un niño" }),
  });
  assert.match(texto, /^\*Reserva — El Sabroso\*/);
  assert.match(texto, /a nombre de Ana para el 20 de octubre, 2026 a las 20:00/);
  assert.match(texto, /para 4 personas\./);
  assert.match(texto, /Nota: Vamos con un niño/);
  assert.ok(texto.endsWith("Reserva desde La Verde"));
});

test("una plantilla propia manda, y un hueco desconocido se deja tal cual", () => {
  const texto = mensajeReserva({
    negocio: "El Sabroso",
    tipo: "cita",
    plantilla: "Cita para {nombre} el {fecha} a las {hora}. {loquesea}",
    datos: datos(),
  });
  assert.match(texto, /Cita para Ana el 20 de octubre, 2026 a las 20:00\./);
  assert.match(texto, /\{loquesea\}/);
});

test("el apartado rellena producto y cantidad sin duplicar líneas", () => {
  const texto = mensajeReserva({
    negocio: "La Dulcería",
    tipo: "apartado",
    plantilla: null,
    datos: datos({ producto: "Tarta de chocolate", cantidad: 2, personas: undefined }),
  });
  assert.match(texto, /apartar Tarta de chocolate x2 a nombre de Ana/);
  assert.equal((texto.match(/\{/g) ?? []).length, 0);
});

test("sin reserva habilitada no hay configuración de botón", () => {
  assert.equal(
    configReserva({ name: "X", menu: [], reservaHabilitada: false }),
    undefined,
  );
});

test("el tipo por defecto es mesa y el aforo sale tal cual", () => {
  const config = configReserva({
    name: "El Sabroso",
    whatsapp: "+53551234567",
    reservaHabilitada: true,
    menu: [],
  });
  assert.equal(config?.tipo, "mesa");
  assert.equal(config?.aforoMaxPersonas, null);
  assert.equal(config?.whatsapp, "+53551234567");
});

test("un apartado sin productos no ofrece botón", () => {
  assert.equal(
    configReserva({
      name: "X",
      reservaHabilitada: true,
      tipoReserva: "apartado",
      menu: [{ id: "a", name: "   " }],
    }),
    undefined,
  );
});

test("el apartado lista la carta, con el nombre como id cuando no lo trae", () => {
  const config = configReserva({
    name: "La Dulcería",
    reservaHabilitada: true,
    tipoReserva: "apartado",
    menu: [
      { id: "tarta", name: "Tarta" },
      { name: "Flan" },
      { name: "  " },
    ],
  });
  assert.deepEqual(config?.productos, [
    { id: "tarta", name: "Tarta" },
    { id: "Flan", name: "Flan" },
  ]);
});

test("el enlace lleva el número sin signos y el mensaje escapado", () => {
  assert.equal(
    hrefReserva("+53 5 123 4567", "uno\ndos"),
    "https://wa.me/5351234567?text=uno%0Ados",
  );
  assert.equal(hrefReserva("", "x"), "");
});

test("la fecha local se escribe ISO sin depender de UTC", () => {
  /* Medianoche local: en UTC-5 ya es el día siguiente en UTC, y aun así tiene
     que salir el día local o el `min` del calendario se corre uno. */
  assert.equal(fechaLocalIso(new Date(2026, 9, 5)), "2026-10-05");
  assert.equal(fechaLocalIso(new Date(2026, 0, 1)), "2026-01-01");
  assert.equal(fechaLocalIso(new Date(2026, 11, 31, 23, 59)), "2026-12-31");
});

test("el margen deja pasar ayer para el servidor, y solo ayer", () => {
  /* Sin margen, el mismo día vale y ayer no. */
  assert.equal(errorFechaReserva("2026-10-15", HOY), null);
  assert.match(errorFechaReserva("2026-10-14", HOY) ?? "", /pasado/);
  /* Con un día de margen —el desfase horario del cliente— ayer pasa. */
  assert.equal(errorFechaReserva("2026-10-14", HOY, 1), null);
  assert.match(errorFechaReserva("2026-10-13", HOY, 1) ?? "", /pasado/);
  /* El margen corre también el tope de los 30 días. */
  assert.equal(errorFechaReserva("2026-11-15", HOY, 1), null);
  assert.match(errorFechaReserva("2026-11-16", HOY, 1) ?? "", /30 días/);
  /* Una fecha imposible se cae antes que nada. */
  assert.match(errorFechaReserva("2026-02-31", HOY) ?? "", /fecha/);
});

test("el cupo del día: cabe, no cabe, y sin cupo no opina", () => {
  assert.equal(avisoCupo(4, 0, 10), null);
  assert.equal(avisoCupo(10, 0, 10), null);
  assert.equal(avisoCupo(11, 0, 10), "Ese día solo quedan 10 plazas.");
  assert.equal(avisoCupo(1, 10, 10), "Ese día ya no hay espacio.");
  assert.equal(avisoCupo(2, 9, 10), "Ese día solo quedan 1 plaza.");
  /* `null` y `0` son «no lo configuró», no «no cabe nadie». */
  assert.equal(avisoCupo(50, 0, null), null);
  assert.equal(avisoCupo(50, 0, 0), null);
  assert.equal(avisoCupo(50, 0, undefined), null);
});

test("el cupo del día bloquea la reserva de mesa, y no toca la cita", () => {
  const cupo = { ocupadas: 8, capacidad: 10 };
  assert.equal(validarReserva(datos({ personas: 2 }), "mesa", HOY, null, cupo), null);
  assert.equal(
    validarReserva(datos({ personas: 3 }), "mesa", HOY, null, cupo),
    "Ese día solo quedan 2 plazas.",
  );
  /* La cita no consume cupo: no pide personas. */
  assert.equal(
    validarReserva(datos(), "cita", HOY, null, { ocupadas: 10, capacidad: 10 }),
    null,
  );
  /* Sin cupo configurado, el día lleno no dice nada. */
  assert.equal(
    validarReserva(datos({ personas: 4 }), "mesa", HOY, null, {
      ocupadas: 99,
      capacidad: null,
    }),
    null,
  );
});

test("el aforo por reserva gana al cupo cuando el grupo no cabe ni en mesa vacía", () => {
  assert.match(
    validarReserva(datos({ personas: 9 }), "mesa", HOY, 8, {
      ocupadas: 0,
      capacidad: 10,
    }) ?? "",
    /hasta 8 personas/,
  );
});

test("el cupo diario sale de la ficha al armar la configuración", () => {
  const conCupo = configReserva({
    name: "El Sabroso",
    whatsapp: "+53551234567",
    reservaHabilitada: true,
    aforoDiarioPersonas: 40,
    menu: [],
  });
  assert.equal(conCupo?.capacidadDiaria, 40);
  /* Sin cupo en la ficha, `null`: el formulario no consulta ni bloquea. */
  assert.equal(conCupo?.aforoMaxPersonas, null);
  const sinCupo = configReserva({
    name: "El Sabroso",
    reservaHabilitada: true,
    menu: [],
  });
  assert.equal(sinCupo?.capacidadDiaria, null);
});
