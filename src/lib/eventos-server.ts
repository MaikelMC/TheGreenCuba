import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { businessOwners, eventosDiarios, eventosUnicos } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import type { TipoEvento, VisitasPanel } from "@/lib/eventos";
import { incluye, type Plan } from "@/lib/plans";

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
 * Se para en cuanto el plan no da para más: un negocio Gratis no paga las otras
 * consultas, y —lo que importa de verdad— lo que no entra en su plan no sale de
 * la base, así que no hay nada que un cliente curioso pueda mirar por encima del
 * candado.
 */
export async function statsVisitas(
  negocioId: string,
  plan: Plan,
): Promise<VisitasPanel> {
  const mes = diaUtc().slice(0, 7);

  const [resumen] = await db
    .select({
      n: sql<number>`coalesce(sum(${eventosDiarios.conteo}), 0)::int`,
    })
    .from(eventosDiarios)
    .where(
      and(
        eq(eventosDiarios.negocioId, negocioId),
        eq(eventosDiarios.tipo, "vista_perfil"),
        gte(eventosDiarios.fecha, `${mes}-01`),
      ),
    );

  const panel: VisitasPanel = { resumen: { mes: resumen?.n ?? 0 } };
  if (!incluye(plan, "stats_basicas")) return panel;

  /* Las dos ventanas en una sola consulta: `filter` deja cada suma en su
     columna, así que el viaje es uno y no dos. */
  const desde7 = diaUtc(6);
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
        inArray(eventosDiarios.tipo, ["vista_perfil", "click_llamar"]),
      ),
    )
    .groupBy(eventosDiarios.tipo);

  const visitas = filas.find((f) => f.tipo === "vista_perfil");
  const llamadas = filas.find((f) => f.tipo === "click_llamar");

  panel.basicas = {
    visitas7: visitas?.corto ?? 0,
    llamadas7: llamadas?.corto ?? 0,
    visitas30: visitas?.largo ?? 0,
    llamadas30: llamadas?.largo ?? 0,
  };

  if (!incluye(plan, "stats_completas")) return panel;

  const DIAS = 14;
  const serie = await db
    .select({
      fecha: eventosDiarios.fecha,
      conteo: sql<number>`coalesce(sum(${eventosDiarios.conteo}), 0)::int`,
    })
    .from(eventosDiarios)
    .where(
      and(
        eq(eventosDiarios.negocioId, negocioId),
        eq(eventosDiarios.tipo, "vista_perfil"),
        gte(eventosDiarios.fecha, diaUtc(DIAS - 1)),
      ),
    )
    .groupBy(eventosDiarios.fecha);

  /* Los días sin visitas no existen en la tabla y el gráfico los necesita: sin
     rellenar, las barras se reparten el ancho a saltos y la línea miente. */
  const porDia = new Map(serie.map((f) => [f.fecha, f.conteo]));
  const completa = Array.from({ length: DIAS }, (_, i) => {
    const fecha = diaUtc(DIAS - 1 - i);
    return { fecha, conteo: porDia.get(fecha) ?? 0 };
  });

  const top = await db
    .select({
      nombre: eventosDiarios.dimension,
      conteo: sql<number>`coalesce(sum(${eventosDiarios.conteo}), 0)::int`,
    })
    .from(eventosDiarios)
    .where(
      and(
        eq(eventosDiarios.negocioId, negocioId),
        eq(eventosDiarios.tipo, "producto_visto"),
        gte(eventosDiarios.fecha, desde30),
      ),
    )
    .groupBy(eventosDiarios.dimension)
    .orderBy(desc(sql`coalesce(sum(${eventosDiarios.conteo}), 0)`))
    .limit(5);

  panel.completas = {
    serie: completa,
    topProductos: top.filter((f) => f.nombre !== ""),
  };

  return panel;
}
