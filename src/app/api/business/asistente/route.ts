import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { canManagePlace } from "@/lib/admin-server";
import { CODIGO_TTL_MIN, enlaceVinculacion, generarCodigo } from "@/lib/asistente";
import { db } from "@/lib/db";
import { asistenteCodigos, telegramVinculos } from "@/lib/db/schema";
import { puede } from "@/lib/plans-server";
import { botUsuario } from "@/lib/seguidores-server";
import { generateId } from "@/lib/utils";

/**
 * El código de vinculación del asistente, para la tarjeta del panel.
 *
 * Es la puerta que faltaba: el bot sabe canjear un código —lo espera en
 * `/start CODIGO`—, pero hasta ahora nadie los generaba. **El código es la
 * credencial**, así que quien lo pide tiene que poder gestionar el negocio
 * (`canManagePlace`) y el plan tiene que incluir el asistente (`puede`): el
 * candado del cliente es información, el permiso se decide aquí.
 *
 * `GET` enseña lo que hay —si ya hay un chat vinculado y el código vivo, si
 * queda alguno— y `POST` genera uno nuevo. Ninguno de los dos guarda el código
 * en claro más allá de su fila: caduca en diez minutos y solo vale una vez.
 */
export const dynamic = "force-dynamic";

interface Estado {
  /** Ya hay un chat escribiéndole al bot por este negocio. */
  vinculado: boolean;
  /** El código vivo, si lo hay. `null` = no hay ninguno, hay que generar. */
  codigo: string | null;
  /** Cuándo caduca el código vivo. ISO, o `null`. */
  expiraEn: string | null;
  /** El enlace que abre el bot con el código ya detrás. `null` sin bot. */
  enlace: string | null;
  /** El nombre del bot, sin `@`. Vacío = no hay bot configurado. */
  bot: string;
  /** Días que dura el código. Lo pinta la tarjeta para explicarse. */
  minutosValidez: number;
}

/** Lee el estado del negocio: vínculo, código vivo y enlace. */
async function leerEstado(negocioId: string): Promise<Estado> {
  const ahora = new Date();
  const bot = botUsuario();

  const [vinculo, codigoVivo] = await Promise.all([
    db
      .select({ id: telegramVinculos.id })
      .from(telegramVinculos)
      .where(eq(telegramVinculos.negocioId, negocioId))
      .limit(1),
    db
      .select({ codigo: asistenteCodigos.codigo, expiraEn: asistenteCodigos.expiraEn })
      .from(asistenteCodigos)
      .where(
        and(
          eq(asistenteCodigos.negocioId, negocioId),
          isNull(asistenteCodigos.usadoEn),
          gt(asistenteCodigos.expiraEn, ahora),
        ),
      )
      .orderBy(desc(asistenteCodigos.creado))
      .limit(1),
  ]);

  const codigo = codigoVivo[0]?.codigo ?? null;

  return {
    vinculado: vinculo.length > 0,
    codigo,
    expiraEn: codigoVivo[0]?.expiraEn.toISOString() ?? null,
    /* Sin bot no hay enlace: mejor `null` explícito que una url a medias. */
    enlace: codigo ? enlaceVinculacion(bot, codigo) : null,
    bot,
    minutosValidez: CODIGO_TTL_MIN,
  };
}

/** El negocio del cuerpo o de la query, ya comprobado contra el permiso. */
async function autorizar(
  req: NextRequest,
  negocioId: string | null,
): Promise<string | null> {
  if (!negocioId) return null;
  if (!(await canManagePlace(req, negocioId))) return null;
  return negocioId;
}

export async function GET(req: NextRequest) {
  const pedido = req.nextUrl.searchParams.get("negocioId")?.trim() ?? "";
  const negocioId = await autorizar(req, pedido);
  if (!negocioId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!(await puede(negocioId, "asistente_ia"))) {
    return NextResponse.json(
      { error: "El asistente de Telegram está disponible en el plan Pro." },
      { status: 403 },
    );
  }

  return NextResponse.json(await leerEstado(negocioId));
}

export async function POST(req: NextRequest) {
  const cuerpo = (await req.json().catch(() => ({}))) as { negocioId?: string };
  const negocioId = await autorizar(req, cuerpo.negocioId?.trim() ?? null);
  if (!negocioId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  /* Sin bot configurado no se genera nada: el código no tendría a quién canjearlo
     y el dueño se quedaría mirando un número que no funciona. */
  if (!botUsuario()) {
    return NextResponse.json(
      { error: "El bot todavía no está configurado." },
      { status: 503 },
    );
  }

  if (!(await puede(negocioId, "asistente_ia"))) {
    return NextResponse.json(
      { error: "El asistente de Telegram está disponible en el plan Pro." },
      { status: 403 },
    );
  }

  /* Fuera los caducados y sin usar de este negocio: se acumularían uno por cada
     vez que el dueño pulsa el botón, y el código solo vale diez minutos. */
  await db
    .delete(asistenteCodigos)
    .where(
      and(
        eq(asistenteCodigos.negocioId, negocioId),
        isNull(asistenteCodigos.usadoEn),
        sql`${asistenteCodigos.expiraEn} <= now()`,
      ),
    );

  const expiraEn = new Date(Date.now() + CODIGO_TTL_MIN * 60_000);

  await db.insert(asistenteCodigos).values({
    id: generateId(),
    negocioId,
    codigo: generarCodigo(),
    expiraEn,
  });

  return NextResponse.json(await leerEstado(negocioId));
}
