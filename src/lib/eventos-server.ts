import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { businessOwners, eventosDiarios, eventosUnicos } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { TIPOS_VISTA, type TipoEvento, type VisitasPanel } from "@/lib/eventos";
import type { Funcion } from "@/lib/plans";

/**
 * El lado servidor de las estadísticas: escribir los eventos agregados y leer
 * lo que el panel enseña.
 *
 * Nada de esto puede tumbar el gesto que lo originó. Escribir es best-effort
 * —un evento perdido no es un error de producto— y leer está detrás del plan,
 * resuelto aquí y no en el navegador.
 */

/** «YYYY-MM-DD» en UTC, con `offset` días hacia atrás. */
export function diaUtc(offset = 0): string {
  return new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
}

/** Un evento ya resuelto: negocio, tipo, dimensión y quién (hash diario). */
export interface EventoResuelto {
  negocioId: string;
  tipo: TipoEvento;
  dimension: string;
  fecha: string;
  visitante: string;
}

/**
 * Sube los contadores. Dos escrituras por evento y en este orden:
 *
 * 1. La **valla**: intenta apuntar al visitante en `eventos_unicos`. Si la fila
 *    ya estaba, `onConflictDoNothing` no devuelve nada y sabemos que no es nuevo.
 * 2. El **agregado**: suma uno al `conteo` siempre, y suma uno a `unicos` solo
 *    cuando la valla aceptó al visitante.
 *
 * Los contadores se incrementan en SQL (`conteo + 1`) y no en JavaScript: dos
 * beacons a la vez no se pisan. `onConflictDoUpdate` va contra la clave
 * (negocio, día, tipo, dimensión), que es la única.
 */
export async function registrarEventos(
  eventos: EventoResuelto[],
): Promise<void> {
  for (const evento of eventos) {
    try {
      const nuevos = await db
        .insert(eventosUnicos)
        .values({
          negocioId: evento.negocioId,
          fecha: evento.fecha,
          tipo: evento.tipo,
          dimension: evento.dimension,
          visitante: evento.visitante,
        })
        .onConflictDoNothing()
        .returning({ visitante: eventosUnicos.visitante });

      const unico = nuevos.length > 0 ? 1 : 0;

      await db
        .insert(eventosDiarios)
        .values({
          id: generateId(),
          negocioId: evento.negocioId,
          fecha: evento.fecha,
          tipo: evento.tipo,
          dimension: evento.dimension,
          conteo: 1,
          unicos: unico,
        })
        .onConflictDoUpdate({
          target: [
            eventosDiarios.negocioId,
            eventosDiarios.fecha,
            eventosDiarios.tipo,
            eventosDiarios.dimension,
          ],
          set: {
            conteo: sql`${eventosDiarios.conteo} + 1`,
            unicos: sql`${eventosDiarios.unicos} + ${unico}`,
            updatedAt: new Date(),
          },
        });
    } catch (error) {
      /* Evento perdido, panel sin una cifra: el visitante no debe enterarse. */
      console.error(
        "[eventos] no se pudo registrar:",
        error instanceof Error ? error.message : error,
      );
    }
  }
}

/** Si el usuario lleva este negocio. Es lo que mantiene al dueño fuera del conteo. */
export async function esDueno(
  userId: string,
  negocioId: string,
): Promise<boolean> {
  const [fila] = await db
    .select({ id: businessOwners.id })
    .from(businessOwners)
    .where(
      and(
        eq(businessOwners.userId, userId),
        eq(businessOwners.placeId, negocioId),
      ),
    )
    .limit(1);
  return Boolean(fila);
}

/**
 * Las cifras del panel, **ya recortadas por plan**.
 *
 * Todas las visitas son `TIPOS_VISTA`: la ficha y la carta, que para el dueño son
 * la misma cosa mirada desde dos sitios.
 *
 * Se para en cuanto el plan no da para más: un negocio Gratis no paga las otras
 * consultas, y —lo que importa de verdad— lo que no entra en su plan no sale de
 * la base, así que no hay nada que un cliente curioso pueda mirar por encima del
 * candado.
 */
export async function statsVisitas(
  negocioId: string,
  funciones: ReadonlySet<Funcion>,
): Promise<VisitasPanel> {
  const mes = diaUtc().slice(0, 7);
  const desde7 = diaUtc(6);

  /* El mes, el total histórico y la última semana en una sola consulta: `filter`
     deja cada suma en su columna y el `groupBy` por tipo permite separar ficha
     de carta sin un viaje más. Sin `gte`, el recorrido es todo el histórico del
     negocio, pero es su histórico —el índice por negocio y fecha lo acota—. */
  const filasResumen = await db
    .select({
      tipo: eventosDiarios.tipo,
      mes: sql<number>`coalesce(sum(${eventosDiarios.conteo}) filter (where ${eventosDiarios.fecha} >= ${`${mes}-01`}), 0)::int`,
      total: sql<number>`coalesce(sum(${eventosDiarios.conteo}), 0)::int`,
      semana: sql<number>`coalesce(sum(${eventosDiarios.conteo}) filter (where ${eventosDiarios.fecha} >= ${desde7}), 0)::int`,
    })
    .from(eventosDiarios)
    .where(
      and(
        eq(eventosDiarios.negocioId, negocioId),
        inArray(eventosDiarios.tipo, TIPOS_VISTA),
      ),
    )
    .groupBy(eventosDiarios.tipo);

  const resumen = { mes: 0, total: 0, ficha7: 0, catalogo7: 0 };
  for (const fila of filasResumen) {
    resumen.mes += fila.mes;
    resumen.total += fila.total;
    if (fila.tipo === "vista_perfil") resumen.ficha7 += fila.semana;
    else resumen.catalogo7 += fila.semana;
  }

  const panel: VisitasPanel = { resumen };
  if (!funciones.has("stats_basicas")) return panel;

  /* Las dos ventanas en una sola consulta: `filter` deja cada suma en su
     columna, así que el viaje es uno y no dos. */
  const desde30 = diaUtc(29);
  const filas = await db
    .select({
      tipo: eventosDiarios.tipo,
      corto: sql<number>`coalesce(sum(${eventosDiarios.conteo}) filter (where ${eventosDiarios.fecha} >= ${desde7}), 0)::int`,
      largo: sql<number>`coalesce(sum(${eventosDiarios.conteo}), 0)::int`,
    })
    .from(eventosDiarios)
    .where(
      and(
        eq(eventosDiarios.negocioId, negocioId),
        gte(eventosDiarios.fecha, desde30),
        inArray(eventosDiarios.tipo, [...TIPOS_VISTA, "click_llamar"]),
      ),
    )
    .groupBy(eventosDiarios.tipo);

  /* La consulta agrupa por tipo, así que la carta y la ficha llegan en dos
     filas: se suman aquí. */
  const visitas = filas.filter((f) => TIPOS_VISTA.includes(f.tipo));
  const llamadas = filas.find((f) => f.tipo === "click_llamar");
  const suma = (campo: "corto" | "largo") =>
    visitas.reduce((n, f) => n + f[campo], 0);

  panel.basicas = {
    visitas7: suma("corto"),
    llamadas7: llamadas?.corto ?? 0,
    visitas30: suma("largo"),
    llamadas30: llamadas?.largo ?? 0,
  };

  return panel;
}
