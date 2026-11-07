import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { packsMedida, pagos, suscripciones } from "@/lib/db/schema";
import { crearSuscripcion } from "@/lib/plans-server";
import { calcularVencimiento } from "@/lib/pack-medida";
import { generateId } from "@/lib/utils";
import type { Pack } from "@/lib/plans";

type FilaPago = typeof pagos.$inferSelect;

/**
 * Aplica lo contratado tras un pago confirmado.
 *
 * Fue parte del webhook; vive aquí para que la ruta de cobro pueda llamarla
 * en el caso de descuento del 100 % sin pasar por QvaPay.
 *
 * El guardia `estado <> 'pagado'` se repite en las dos sentencias del lote:
 * la de la suscripción decide si se toca, y la del pago lo marca. Si el pago
 * ya estaba pagado las dos son un no-op, así que el reintento de QvaPay no
 * suma dos meses.
 */
export async function aplicarDerecho(pago: FilaPago): Promise<void> {
  const sigueCobrable = sql`exists (
    select 1 from ${pagos}
    where ${pagos.id} = ${pago.id} and ${pagos.estado} <> 'pagado'
  )`;

  const marcaPagado = db
    .update(pagos)
    .set({ estado: "pagado", pagadoEn: sql`now()` })
    .where(and(eq(pagos.id, pago.id), sql`${pagos.estado} <> 'pagado'`));

  if (pago.tipo === "pack_medida") {
    const packId = pago.packMedidaId ?? pago.clave;

    const [pack] = await db
      .select({ oferta2x1: packsMedida.oferta2x1, venceEn: packsMedida.venceEn })
      .from(packsMedida)
      .where(eq(packsMedida.id, packId))
      .limit(1);

    const ahora = new Date();
    const venceEn = calcularVencimiento({
      desde: ahora,
      oferta2x1: pack?.oferta2x1 ?? false,
      venceEnActual: pack?.venceEn ?? null,
    });

    await db.batch([
      db
        .update(packsMedida)
        .set({ estado: "pagado", pagadoEn: ahora, venceEn })
        .where(and(eq(packsMedida.id, packId), sql`${packsMedida.estado} <> 'pagado'`)),
      db
        .update(suscripciones)
        .set({ trialHasta: null })
        .where(
          and(
            eq(suscripciones.negocioId, pago.negocioId),
            sql`${suscripciones.trialHasta} > now()`,
          ),
        ),
      marcaPagado,
    ]);
    return;
  }

  if (pago.tipo === "plan") {
    await db.batch([
      db
        .insert(suscripciones)
        .values({
          id: generateId(),
          negocioId: pago.negocioId,
          plan: pago.clave as Pack,
          estado: "activa",
          venceEn: sql`now() + interval '30 days'`,
        })
        .onConflictDoUpdate({
          target: suscripciones.negocioId,
          set: {
            plan: pago.clave as Pack,
            estado: "activa",
            venceEn: sql`case
              when ${suscripciones.plan} = ${pago.clave}
                and ${suscripciones.venceEn} is not null
                and ${suscripciones.venceEn} > now()
                then ${suscripciones.venceEn} + interval '30 days'
              when ${suscripciones.plan} = ${pago.clave}
                and ${suscripciones.venceEn} is null
                then null
              else now() + interval '30 days'
            end`,
          },
          setWhere: sigueCobrable,
        }),
      marcaPagado,
    ]);
    return;
  }

  /* módulo suelto */
  await crearSuscripcion(pago.negocioId);

  const modulos = sql`(
    select coalesce(jsonb_agg(elem), '[]'::jsonb)
    from jsonb_array_elements(${suscripciones.modulos}) as elem
    where elem->>'clave' <> ${pago.clave}
  ) || jsonb_build_array(jsonb_build_object(
    'clave', ${pago.clave},
    'desde', to_jsonb(coalesce(
      (
        select e->>'desde'
        from jsonb_array_elements(${suscripciones.modulos}) as e
        where e->>'clave' = ${pago.clave}
        limit 1
      ),
      now()::text
    )),
    'hasta', to_jsonb(case
      when exists (
        select 1
        from jsonb_array_elements(${suscripciones.modulos}) as e
        where e->>'clave' = ${pago.clave}
          and e->>'hasta' is not null
          and (e->>'hasta')::timestamptz > now()
      ) then (
        select (e->>'hasta')::timestamptz
        from jsonb_array_elements(${suscripciones.modulos}) as e
        where e->>'clave' = ${pago.clave} and e->>'hasta' is not null
        order by (e->>'hasta')::timestamptz desc
        limit 1
      ) + interval '30 days'
      else now() + interval '30 days'
    end)
  ))`;

  await db.batch([
    db
      .update(suscripciones)
      .set({ modulos })
      .where(and(eq(suscripciones.negocioId, pago.negocioId), sigueCobrable)),
    marcaPagado,
  ]);
}
