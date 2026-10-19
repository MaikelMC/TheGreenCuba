import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { pagos, suscripciones } from "@/lib/db/schema";
import { crearSuscripcion } from "@/lib/plans-server";
import type { Pack } from "@/lib/plans";
import {
  CABECERA_FIRMA,
  CABECERA_TIEMPO,
  centavos,
  consultarTransaccion,
  firmaValida,
  tiempoValido,
} from "@/lib/qvapay";
import { generateId } from "@/lib/utils";

/**
 * El único sitio que activa un plan pagado.
 *
 * QvaPay firma el cuerpo **crudo** con `app-secret` y manda tres cosas: la
 * factura, el estado y, si no viene el importe, la posibilidad de preguntarle a
 * su API. Aquí se comprueban las tres antes de dar nada:
 *
 * 1. La firma HMAC y la ventana de cinco minutos — un aviso viejo reenviado no
 *    vale.
 * 2. Que la factura sea la que creó este servidor (`qvapay_id`) y que el
 *    `remote_id` sea nuestra fila de `pagos`.
 * 3. Que el importe coincida **en centavos** con el que se calculó al abrir la
 *    factura. Si el cuerpo no lo trae, se pregunta a QvaPay.
 *
 * La activación va en un `db.batch`: una sola transacción de Neon con el aviso
 * de pago y el derecho contratado. El `where` del upsert exige que el pago siga
 * sin estar pagado, así que el reintento de QvaPay —que puede llegar dos veces—
 * no suma dos meses.
 */

const PAGADOS = new Set(["paid", "pagado", "completed", "success", "succeeded"]);
const FALLIDOS = new Set([
  "failed",
  "cancelled",
  "canceled",
  "expired",
  "refunded",
  "rejected",
]);

function json(mensaje: string, status: number) {
  return NextResponse.json({ error: mensaje }, { status });
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

type FilaPago = typeof pagos.$inferSelect;

/**
 * Aplica lo contratado. El guardia `estado <> 'pagado'` se repite en las dos
 * sentencias del lote: la de la suscripción decide si se toca, y la del pago lo
 * marca. Si el pago ya estaba pagado, las dos son un no-op.
 */
async function aplicarDerecho(pago: FilaPago): Promise<void> {
  const sigueCobrable = sql`exists (
    select 1 from ${pagos}
    where ${pagos.id} = ${pago.id} and ${pagos.estado} <> 'pagado'
  )`;

  const marcaPagado = db
    .update(pagos)
    .set({ estado: "pagado", pagadoEn: sql`now()` })
    .where(and(eq(pagos.id, pago.id), sql`${pagos.estado} <> 'pagado'`));

  if (pago.tipo === "plan") {
    /* Mismo plan y todavía vigente = se suma un mes al final. Cambio de plan o
       plan vencido = un mes desde ahora. `vence_en` nulo significa «sin
       vencimiento» y se respeta. */
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

  /* Un módulo sin fila de suscripción no tendría dónde apuntarse: la fila se
     crea antes, con el mismo alta idempotente del registro. */
  await crearSuscripcion(pago.negocioId);

  /* Se quita la entrada vieja del módulo y se añade la nueva. `desde` se
     conserva; `hasta` se suma al que quedara si aún no venció, y si no, un mes
     desde hoy. La comparación se hace como `timestamptz`, aunque en el jsonb se
     guarde como cadena ISO. */
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
      .where(
        and(eq(suscripciones.negocioId, pago.negocioId), sigueCobrable),
      ),
    marcaPagado,
  ]);
}

export async function POST(req: NextRequest) {
  const secreto = process.env.QVAPAY_APP_SECRET?.trim();
  if (!secreto) return json("QvaPay no está configurado.", 503);

  /* Cuerpo crudo: la firma se calcula sobre estos bytes, no sobre el JSON
     vuelto a serializar. */
  const crudo = await req.text();

  if (!firmaValida(crudo, req.headers.get(CABECERA_FIRMA), secreto)) {
    return json("Firma inválida.", 401);
  }
  if (!tiempoValido(req.headers.get(CABECERA_TIEMPO))) {
    return json("Aviso caducado.", 401);
  }

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(crudo);
  } catch {
    return json("Cuerpo inválido.", 400);
  }

  const body = objeto(cuerpo);
  if (!body) return json("Cuerpo inválido.", 400);

  const tx = objeto(body.transaction) ?? objeto(body.data) ?? body;
  const uuid =
    texto(tx.transaction_uuid) ||
    texto(tx.uuid) ||
    texto(body.transaction_uuid) ||
    texto(body.uuid);
  const remoteId = texto(tx.remote_id) || texto(body.remote_id);

  if (!uuid) return json("Falta la transacción.", 400);

  let [fila] = await db
    .select()
    .from(pagos)
    .where(eq(pagos.qvapayId, uuid))
    .limit(1);

  /* Si la factura existe pero la fila no llegó a guardar su uuid —un corte de
     red entre crear la factura y escribirla—, el `remote_id` firmado sigue
     identificando el pago. Solo se acepta si no hay otro uuid guardado. */
  if (!fila && remoteId) {
    const [porRemote] = await db
      .select()
      .from(pagos)
      .where(eq(pagos.id, remoteId))
      .limit(1);

    if (porRemote) {
      if (porRemote.qvapayId && porRemote.qvapayId !== uuid) {
        return json("La transacción no es la de este pago.", 400);
      }
      fila = porRemote;
      if (!porRemote.qvapayId) {
        await db
          .update(pagos)
          .set({ qvapayId: uuid })
          .where(eq(pagos.id, porRemote.id));
      }
    }
  }

  /* Una transacción firmada que no es nuestra no tiene nada que hacer aquí. Se
     contesta 2xx para que QvaPay no reintente un aviso que nunca aplicará. */
  if (!fila) return NextResponse.json({ ok: true, ignorado: true });

  if (remoteId && remoteId !== fila.id) {
    return json("La factura no corresponde a este pago.", 400);
  }

  if (fila.estado === "pagado") {
    return NextResponse.json({ ok: true, repetido: true });
  }

  const estado = (
    texto(tx.status) ||
    texto(body.status)
  ).toLowerCase();

  if (FALLIDOS.has(estado)) {
    await db
      .update(pagos)
      .set({ estado: "fallido" })
      .where(and(eq(pagos.id, fila.id), sql`${pagos.estado} <> 'pagado'`));
    return NextResponse.json({ ok: true });
  }

  if (!PAGADOS.has(estado)) {
    /* Pendiente o un estado que no conocemos: se acusa recibo y no se toca
       nada. El aviso definitivo llegará o lo dirá la consulta a QvaPay. */
    return NextResponse.json({ ok: true });
  }

  /* La firma y el uuid ya identifican una factura que creó este servidor, así
     que un aviso firmado de «pagado» es prueba suficiente. El importe se
     contrasta cuando viene; si no viene, no se bloquea un cobro real por un
     campo de más o de menos. Si viene y no cuadra, se pregunta a la API. */
  const montoCuerpo = centavos(tx.amount ?? body.amount);
  let confirmado = montoCuerpo === null || montoCuerpo === fila.montoCentavos;

  if (!confirmado) {
    try {
      const real = await consultarTransaccion(uuid);
      confirmado = Boolean(
        real &&
          PAGADOS.has(real.estado) &&
          real.montoCentavos === fila.montoCentavos &&
          (!real.remoteId || real.remoteId === fila.id),
      );
    } catch (error) {
      console.error("[qvapay] no se pudo confirmar la transacción", error);
      return json("No se pudo confirmar el cobro.", 502);
    }
  }

  if (!confirmado) {
    console.error(
      `[qvapay] importe no coincide para el pago ${fila.id}: ${String(
        montoCuerpo,
      )} contra ${fila.montoCentavos}`,
    );
    return json("El importe no coincide con la factura.", 400);
  }

  await aplicarDerecho(fila);
  return NextResponse.json({ ok: true });
}
