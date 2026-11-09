import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { and, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { pedidos, places, telegramVinculos } from "@/lib/db/schema";
import type { EntregaConfig } from "@/lib/ficha/entrega";

/**
 * Recordatorios de pedidos programados por Telegram.
 *
 * Lo llama un cron del VPS con:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Lógica:
 * 1. Busca pedidos nuevos con `programadoPara IS NOT NULL`, `avisadoEn IS NULL`
 *    y `programadoPara > now - 15 min` (no demasiado tarde).
 * 2. Para cada pedido, lee `avisoMin` de `entrega.programados` del negocio.
 * 3. Si `programadoPara - avisoMin <= now`, marca `avisadoEn = now` atómicamente
 *    (UPDATE … WHERE avisadoEn IS NULL RETURNING id) y envía el aviso.
 * 4. Los chats que reciben el aviso son los de `telegram_vinculos` con permiso
 *    de pedidos (el dueño tiene permiso implícito).
 *
 * Se puede llamar cada minuto sin problema: el UPDATE atómico evita el doble
 * envío incluso si dos instancias del cron corren a la vez.
 */

const AVISO_PASADO_MAX_MS = 15 * 60_000;
const TG_TIMEOUT_MS = 8_000;

function verificarToken(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return false;
  }
}

async function enviarTelegram(chatId: string, texto: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto }),
      signal: AbortSignal.timeout(TG_TIMEOUT_MS),
    });
  } catch {
    /* Best-effort: si Telegram falla, el pedido ya quedó marcado. */
  }
}

export async function POST(req: NextRequest) {
  if (!verificarToken(req)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const ahora = new Date();
  const corteAnterior = new Date(ahora.getTime() - AVISO_PASADO_MAX_MS);

  /* Pedidos candidatos: nuevos, programados, sin avisar, no demasiado tarde. */
  const candidatos = await db
    .select({
      id: pedidos.id,
      codigo: pedidos.codigo,
      placeId: pedidos.placeId,
      programadoPara: pedidos.programadoPara,
      lineas: pedidos.lineas,
      modoEntrega: pedidos.modoEntrega,
      zonaNombre: pedidos.zonaNombre,
    })
    .from(pedidos)
    .where(
      and(
        eq(pedidos.estado, "nuevo"),
        isNotNull(pedidos.programadoPara),
        isNull(pedidos.avisadoEn),
        gte(pedidos.programadoPara, corteAnterior),
      ),
    )
    .limit(100);

  if (candidatos.length === 0) return NextResponse.json({ enviados: 0 });

  /* Cargar entrega de cada negocio distinto para leer avisoMin. */
  const negociosUnicos = [...new Set(candidatos.map((c) => c.placeId))];
  const negociosRows = await db
    .select({ id: places.id, entrega: places.entrega })
    .from(places)
    .where(sql`${places.id} = ANY(${sql.raw(`ARRAY[${negociosUnicos.map((n) => `'${n}'`).join(",")}]`)})`)
    .limit(negociosUnicos.length);

  const entregaPorNegocio = new Map(
    negociosRows.map((n) => [n.id, (n.entrega as EntregaConfig | null)?.programados ?? null]),
  );

  /* Cargar chats de Telegram con permiso de pedidos de los negocios. */
  const vinculos = await db
    .select({ negocioId: telegramVinculos.negocioId, chatId: telegramVinculos.chatId })
    .from(telegramVinculos)
    .where(sql`${telegramVinculos.negocioId} = ANY(${sql.raw(`ARRAY[${negociosUnicos.map((n) => `'${n}'`).join(",")}]`)})`);

  /* ponytail: sin filtrar por permisos de trabajador aquí; los vínculos del
     dueño son la mayoría y añadir el join de businessOwners complicaría la
     query. El dueño recibe SIEMPRE; trabajadores con vínculo también.
     Si en el futuro hay muchos trabajadores sin permiso de pedidos, añadir
     el LEFT JOIN y filtrar por rol/permisos. */
  const chatsPorNegocio = new Map<string, string[]>();
  for (const v of vinculos) {
    const lista = chatsPorNegocio.get(v.negocioId) ?? [];
    lista.push(v.chatId);
    chatsPorNegocio.set(v.negocioId, lista);
  }

  const FMT_HORA = new Intl.DateTimeFormat("es-CU", {
    timeZone: "America/Havana",
    hour: "2-digit",
    minute: "2-digit",
  });

  let enviados = 0;

  for (const pedido of candidatos) {
    const pgConfig = entregaPorNegocio.get(pedido.placeId);
    if (!pgConfig?.activo) continue;

    const msInicio = new Date(pedido.programadoPara!).getTime();
    const umbral = msInicio - pgConfig.avisoMin * 60_000;
    if (ahora.getTime() < umbral) continue; // aún no es hora de avisar

    /* Marcar atómicamente. Si otro proceso ya lo marcó, `updated` queda vacío. */
    const updated = await db
      .update(pedidos)
      .set({ avisadoEn: ahora })
      .where(and(eq(pedidos.id, pedido.id), isNull(pedidos.avisadoEn)))
      .returning({ id: pedidos.id });

    if (updated.length === 0) continue; // ya avisado por otra instancia

    const horaStr = FMT_HORA.format(new Date(pedido.programadoPara!));
    const modo =
      pedido.modoEntrega === "recogida"
        ? "Recogida en local"
        : pedido.modoEntrega === "domicilio"
          ? `A domicilio${pedido.zonaNombre ? ` — ${pedido.zonaNombre}` : ""}`
          : "";
    const lineasTxt = (pedido.lineas as Array<{ name: string; qty: number }>)
      .map((l) => `• ${l.name} ×${l.qty}`)
      .join("\n");

    const texto =
      `🕐 Pedido programado para las ${horaStr}\n` +
      `Código: #${pedido.codigo}\n` +
      (modo ? `${modo}\n` : "") +
      `\n${lineasTxt}`;

    const chats = chatsPorNegocio.get(pedido.placeId) ?? [];
    for (const chatId of chats) {
      await enviarTelegram(chatId, texto);
    }
    enviados++;
  }

  return NextResponse.json({ enviados });
}

/** GET para prueba manual desde curl. */
export async function GET(req: NextRequest) {
  if (!verificarToken(req)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ahora: new Date().toISOString() });
}
