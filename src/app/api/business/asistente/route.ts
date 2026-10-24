import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt, isNull, sql, type SQL } from "drizzle-orm";
import { canManagePlace } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
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

/**
 * Cómo casar el código con quien lo generó. `null` es un vínculo de antes de
 * los trabajadores —o uno creado por un script con `x-admin-key`—: no hay
 * usuario al que atribuirlo y vale cualquier código huérfano.
 */
function deUsuario(userId: string | null): SQL {
  return userId
    ? eq(asistenteCodigos.userId, userId)
    : isNull(asistenteCodigos.userId);
}

/** Lee el estado del negocio: vínculo, código vivo y enlace. */
async function leerEstado(negocioId: string, userId: string | null): Promise<Estado> {
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
          deUsuario(userId),
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

/**
 * El negocio y el usuario que pide, ya comprobados contra el permiso.
 *
 * El `userId` se guarda en el código porque el vínculo del chat lo necesita
 * para saber qué permisos aplicar en cada mensaje. Los administradores y los
 * scripts van con `null` —sin fila en `business_owners`— y el bot los trata
 * como dueño, que es lo que son.
 */
async function autorizar(
  req: NextRequest,
  negocioId: string | null,
): Promise<{ negocioId: string; userId: string | null } | null> {
  if (!negocioId) return null;
  if (!(await canManagePlace(req, negocioId, "telegram"))) return null;

  const user = await getAppUser();
  return {
    negocioId,
    userId: user && user.role !== "admin" ? user.id : null,
  };
}

export async function GET(req: NextRequest) {
  const pedido = req.nextUrl.searchParams.get("negocioId")?.trim() ?? "";
  const acceso = await autorizar(req, pedido);
  if (!acceso) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!(await puede(acceso.negocioId, "asistente_ia"))) {
    return NextResponse.json(
      { error: "El asistente de Telegram está disponible en el plan Pro." },
      { status: 403 },
    );
  }

  return NextResponse.json(await leerEstado(acceso.negocioId, acceso.userId));
}

export async function POST(req: NextRequest) {
  const cuerpo = (await req.json().catch(() => ({}))) as { negocioId?: string };
  const acceso = await autorizar(req, cuerpo.negocioId?.trim() ?? null);
  if (!acceso) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { negocioId } = acceso;

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
    userId: acceso.userId,
    codigo: generarCodigo(),
    expiraEn,
  });

  return NextResponse.json(await leerEstado(negocioId, acceso.userId));
}
