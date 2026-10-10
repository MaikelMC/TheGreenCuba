import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { canManagePlace } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { DEV_PLACE_ID } from "@/lib/dev-place";
import { diaUtc } from "@/lib/eventos-server";
import { incluye } from "@/lib/plans";
import { planEfectivoDe } from "@/lib/plans-server";
import { rateLimit } from "@/lib/rate-limit";
import { errorFechaReserva } from "@/lib/reserva";
import { liberarDia, ocupacionDesde, tomarCupo } from "@/lib/reservas-server";

/**
 * El cupo diario del local: leer cuánto va ocupado, tomar plaza y liberar un día.
 *
 * **`GET` y `POST` son públicos**, como el beacon de estadísticas
 * (`/api/negocio/evento`): los llama el formulario de reserva de la ficha, que
 * abre cualquiera sin sesión. Lo que entra se filtra antes de tocar la base:
 * tope por IP, forma de los campos, y —lo que de verdad importa— que el negocio
 * **ofrezca reservas de mesa** y su plan las incluya. Sin eso, el contador no
 * acepta nada.
 *
 * `DELETE` es del dueño y pasa por `canManagePlace`, el mismo candado que el
 * resto del panel.
 *
 * **No se guarda la reserva**, solo cuántas personas van comprometidas por
 * fecha. Ver `src/lib/reservas-server.ts`.
 */

/** Tope por IP. El formulario manda una o dos peticiones; esto corta el abuso. */
const LIMITE = 30;
const VENTANA_MS = 60_000;

/** El negocio cuyo cupo se puede tocar, o `null` si no ofrece reservas. */
async function cupoDe(
  negocioId: string,
): Promise<{ capacidad: number; aforo: number | null } | null> {
  /* El fixture no tiene fila en `places`, y sin fila no hay dónde apuntar la
     clave foránea de `reservas_dias`. Su ficha enseña el botón —el plan y el
     interruptor los resuelve `conSelloVerificado`— pero el contador no corre:
     el negocio de prueba nunca se llena. */
  if (negocioId === DEV_PLACE_ID) return null;

  const [place] = await db
    .select({
      capacidad: places.aforoDiarioPersonas,
      aforo: places.aforoMaxPersonas,
      acepta: places.aceptaReservas,
      tipo: places.tipoReserva,
      whatsapp: places.whatsapp,
    })
    .from(places)
    .where(eq(places.id, negocioId))
    .limit(1);

  if (!place?.acepta || place.tipo !== "mesa") return null;
  if (!place.whatsapp?.trim()) return null;
  if (!incluye(await planEfectivoDe(negocioId), "reservas_whatsapp")) return null;

  /* Sin cupo configurado se devuelve `null` igual: no hay nada que contar y la
     reserva tiene que salir. El `0` tampoco es un cupo —es un campo vacío que
     llegó hasta aquí— y se lee como el `null`. */
  if (!place.capacidad || place.capacidad <= 0) return null;

  return { capacidad: place.capacidad, aforo: place.aforo ?? null };
}

/**
 * Lo que va ocupado, para que el formulario sepa qué días están llenos.
 *
 * Devuelve `capacidad: null` cuando el negocio no lleva cupo, y el formulario
 * se queda como estaba: sin consultar ni bloquear nada.
 */
export async function GET(req: NextRequest) {
  const limitado = rateLimit(req, LIMITE, VENTANA_MS);
  if (!limitado.ok) {
    return NextResponse.json({ error: "Demasiadas peticiones." }, { status: 429 });
  }

  const negocioId = (req.nextUrl.searchParams.get("negocioId") ?? "")
    .trim()
    .slice(0, 64);
  if (!negocioId) {
    return NextResponse.json({ error: "Falta el negocio." }, { status: 400 });
  }

  const cupo = await cupoDe(negocioId);
  if (!cupo) return NextResponse.json({ capacidad: null, dias: {} });

  return NextResponse.json({
    capacidad: cupo.capacidad,
    dias: await ocupacionDesde(negocioId, diaUtc()),
  });
}

/**
 * Toma plaza para `personas` en `fecha`.
 *
 * El `409` es la respuesta que le importa al cliente: el día se llenó mientras
 * rellenaba el formulario, o entre que lo abrió y lo envió. Va con `restantes`
 * para que el aviso diga cuánto queda y no solo que no.
 */
export async function POST(req: NextRequest) {
  const limitado = rateLimit(req, LIMITE, VENTANA_MS);
  if (!limitado.ok) {
    return NextResponse.json({ error: "Demasiadas peticiones." }, { status: 429 });
  }

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const body = (cuerpo ?? {}) as Record<string, unknown>;
  const negocioId =
    typeof body.negocioId === "string" ? body.negocioId.trim().slice(0, 64) : "";
  const fecha = typeof body.fecha === "string" ? body.fecha.trim() : "";
  const personas = body.personas;

  if (!negocioId) {
    return NextResponse.json({ error: "Falta el negocio." }, { status: 400 });
  }
  if (
    !Number.isInteger(personas) ||
    (personas as number) < 1 ||
    (personas as number) > 1000
  ) {
    return NextResponse.json({ error: "Personas inválidas." }, { status: 400 });
  }

  /* Un día de margen: el «hoy» del cliente y el del servidor no tienen por qué
     caer en la misma fecha. Ver `errorFechaReserva`. */
  const falloFecha = errorFechaReserva(fecha, new Date(), 1);
  if (falloFecha) {
    return NextResponse.json({ error: falloFecha }, { status: 400 });
  }

  const cupo = await cupoDe(negocioId);
  /* Sin cupo no hay nada que contar, y la reserva sale: bloquear aquí una
     reserva de un negocio que sí la ofrece sería el peor de los fallos, porque
     el cliente no tiene forma de arreglarlo. */
  if (!cupo) return NextResponse.json({ ok: true, restantes: null });

  /* El aforo por reserva se valida aquí además de en el formulario. Es la
     segunda vez a propósito: el cliente ya lo comprueba, pero esto es una
     puerta pública, y sin tope por petición alguien llena el cupo de un
     negocio con una sola llamada de mil personas. */
  if (cupo.aforo && (personas as number) > cupo.aforo) {
    return NextResponse.json(
      { error: `Este negocio admite hasta ${cupo.aforo} personas por reserva.` },
      { status: 400 },
    );
  }

  const tomado = await tomarCupo({
    placeId: negocioId,
    fecha,
    personas: personas as number,
    capacidad: cupo.capacidad,
  });

  return NextResponse.json(
    { ok: tomado.ok, restantes: tomado.restantes },
    { status: tomado.ok ? 200 : 409 },
  );
}

/**
 * Suelta el cupo de un día: lo que el dueño hace «a voluntad» cuando le
 * cancelan, cuando hace sitio extra o cuando quiere volver a empezar la cuenta.
 */
export async function DELETE(req: NextRequest) {
  const negocioId = (req.nextUrl.searchParams.get("negocioId") ?? "")
    .trim()
    .slice(0, 64);
  const fecha = (req.nextUrl.searchParams.get("fecha") ?? "").trim();

  if (!negocioId || !fecha) {
    return NextResponse.json(
      { error: "Faltan el negocio o la fecha." },
      { status: 400 },
    );
  }

  if (!(await canManagePlace(req, negocioId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  /* El fixture no tiene filas que liberar: `cupoDe` nunca le cuenta nada. */
  if (negocioId !== DEV_PLACE_ID) await liberarDia(negocioId, fecha);

  return NextResponse.json({ ok: true });
}
