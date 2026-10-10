import { and, eq, gte, sql } from "drizzle-orm";
import { rows } from "@/lib/analytics/sql";
import { db } from "@/lib/db";
import { reservasDias } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";

/**
 * El cupo diario del local: lo único que La Verde **guarda** de una reserva.
 *
 * No se guarda la reserva —quién, cuándo, para qué—, solo cuántas personas van
 * comprometidas en cada fecha. Es lo que hace falta para que el formulario
 * bloquee un día lleno en vez de dejar pasar una reserva que el negocio no
 * puede atender, y es lo que el dueño ve y puede liberar desde el panel.
 *
 * La escritura es **atómica y con la comprobación dentro**: el INSERT y el
 * UPDATE comprueban el cupo en la misma sentencia, así que dos personas
 * reservando a la vez no pueden colarse las dos cuando solo queda una plaza.
 * Comprobar en JavaScript y luego escribir sería justo el bug que este módulo
 * existe para evitar.
 */

type FilaCupo = { personas: number };

/**
 * Cuántas personas van comprometidas por fecha, de `desde` en adelante.
 *
 * Se pide la ventana entera de una vez —las 30 fechas reservables— porque el
 * formulario necesita saber cuáles están llenas antes de que el cliente elija,
 * y eso es una consulta, no treinta.
 */
export async function ocupacionDesde(
  placeId: string,
  desde: string,
): Promise<Record<string, number>> {
  const filas = await db
    .select({ fecha: reservasDias.fecha, personas: reservasDias.personas })
    .from(reservasDias)
    .where(
      and(eq(reservasDias.placeId, placeId), gte(reservasDias.fecha, desde)),
    );

  return Object.fromEntries(filas.map((f) => [f.fecha, f.personas]));
}

/**
 * Toma `personas` del cupo de `fecha`, o dice que ya no caben.
 *
 * Un solo viaje, y la comprobación va dentro del SQL por lo dicho arriba. La
 * primera rama es el caso nuevo —`SELECT` sin `FROM` con `WHERE`, que inserta
 * cero filas si la reserva ya no cabe y deja que el `ON CONFLICT` no llegue a
 * casar—; la segunda, el día que ya tiene fila.
 *
 * **Devuelve `restantes` en las dos ramas** y no solo un booleano: el aviso que
 * ve el cliente es «quedan N», y en el caso de rechazo la única forma de saber
 * N es volver a leer, que es el viaje extra que se paga cuando alguien se queda
 * fuera —poco frecuente y no le importa esperar—.
 */
export async function tomarCupo({
  placeId,
  fecha,
  personas,
  capacidad,
}: {
  placeId: string;
  fecha: string;
  personas: number;
  capacidad: number;
}): Promise<{ ok: boolean; restantes: number }> {
  const filas = await rows<FilaCupo>(sql`
    INSERT INTO reservas_dias (id, place_id, fecha, personas)
    SELECT ${generateId()}, ${placeId}, ${fecha}, ${personas}
    WHERE ${personas} <= ${capacidad}
    ON CONFLICT (place_id, fecha)
    DO UPDATE SET
      personas = reservas_dias.personas + EXCLUDED.personas,
      updated_at = now()
    WHERE reservas_dias.personas + EXCLUDED.personas <= ${capacidad}
    RETURNING personas
  `);

  const tomadas = filas[0]?.personas;
  if (tomadas !== undefined) {
    return { ok: true, restantes: Math.max(0, capacidad - tomadas) };
  }

  const [actual] = await db
    .select({ personas: reservasDias.personas })
    .from(reservasDias)
    .where(
      and(eq(reservasDias.placeId, placeId), eq(reservasDias.fecha, fecha)),
    )
    .limit(1);

  return {
    ok: false,
    restantes: Math.max(0, capacidad - (actual?.personas ?? 0)),
  };
}

/**
 * Suelta el cupo de una fecha: borra la fila y el día vuelve a estar entero.
 *
 * Es el «a voluntad» del dueño. Borrar y no poner a cero a propósito: una fila
 * con `personas: 0` y una fecha sin fila significan lo mismo para todas las
 * consultas —`ocupacionDesde` no la lista y el cupo se lee como lleno—, y la
 * tabla se queda sin ceros que arrastrar.
 */
export async function liberarDia(
  placeId: string,
  fecha: string,
): Promise<void> {
  await db
    .delete(reservasDias)
    .where(
      and(eq(reservasDias.placeId, placeId), eq(reservasDias.fecha, fecha)),
    );
}
