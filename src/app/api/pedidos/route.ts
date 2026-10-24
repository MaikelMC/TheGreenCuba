import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { canManagePlace } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { pedidos, places } from "@/lib/db/schema";
import { DEV_PLACE_ID } from "@/lib/dev-place";
import { rateLimit } from "@/lib/rate-limit";
import { tieneFuncion } from "@/lib/plans-server";
import { generateId } from "@/lib/utils";
import type { LineaPedido } from "@/lib/pedido";

/**
 * El historial de pedidos del catálogo.
 *
 * `POST` es **público**, como el cupo de reservas: lo llama el carrito de la
 * carta, que abre cualquiera sin cuenta. Por eso lo que entra se filtra antes
 * de tocar la base —tope por IP, forma de cada línea y que el negocio reciba
 * pedidos de verdad— y las líneas se contrastan con la carta actual: un id que
 * no está en el menú no entra al historial.
 *
 * `GET` y `PATCH` son del dueño y pasan por `canManagePlace`, el mismo candado
 * que el resto del panel. El historial se lee aunque el plan se haya caído: los
 * pedidos que ya entraron son suyos.
 *
 * El resultado del `POST` no se espera en el navegador —el clic tiene que abrir
 * WhatsApp igual que antes—, así que un fallo aquí no puede romper el pedido.
 */

const LIMITE = 20;
const VENTANA_MS = 60_000;
const MAX_LINEAS = 50;
const MAX_DIRECCION = 200;

const ESTADOS = ["nuevo", "completado", "cancelado"] as const;
type EstadoPedido = (typeof ESTADOS)[number];

function esEstado(valor: unknown): valor is EstadoPedido {
  return ESTADOS.includes(valor as EstadoPedido);
}

/** Texto recortado a un tope, o `null` si no es una cadena con algo dentro. */
function texto(valor: unknown, max: number): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio ? limpio.slice(0, max) : null;
}

/**
 * Las líneas del pedido, ya normalizadas, o `null` si la forma no cuadra.
 *
 * `price` puede quedar vacío —un producto sin cifra—; lo que no puede faltar es
 * el nombre y la cantidad. El tope de cada campo es el mismo que se pinta, así
 * que recortar no cambia un pedido legítimo.
 */
function leerLineas(valor: unknown): LineaPedido[] | null {
  if (!Array.isArray(valor) || valor.length < 1 || valor.length > MAX_LINEAS) {
    return null;
  }

  const lineas: LineaPedido[] = [];
  for (const crudo of valor) {
    if (typeof crudo !== "object" || crudo === null) return null;
    const linea = crudo as Record<string, unknown>;
    const id = texto(linea.id, 120);
    const name = texto(linea.name, 200);
    const qty = linea.qty;

    if (
      !id ||
      !name ||
      !Number.isInteger(qty) ||
      (qty as number) < 1 ||
      (qty as number) > 999
    ) {
      return null;
    }

    lineas.push({
      id,
      name,
      price: typeof linea.price === "string" ? linea.price.trim().slice(0, 40) : "",
      currency:
        typeof linea.currency === "string"
          ? linea.currency.trim().slice(0, 8)
          : "",
      qty: qty as number,
    });
  }
  return lineas;
}

/** Para contrastar nombres sin que «Café» y «cafe» cuenten como distintos. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Guarda el pedido que el cliente acaba de mandar por WhatsApp.
 *
 * El id lo manda el navegador para que un reintento del mismo clic no deje dos
 * filas; si falta o no tiene forma, se genera aquí.
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
  const lineas = leerLineas(body.lineas);

  if (!negocioId) {
    return NextResponse.json({ error: "Falta el negocio." }, { status: 400 });
  }
  if (!lineas) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  /* El negocio de prueba no tiene fila en `places` y, como en las reservas, no
     hay dónde apuntar el pedido. Su carrito sigue funcionando: solo no deja
     historial. */
  if (negocioId === DEV_PLACE_ID) return NextResponse.json({ ok: true });

  const [place] = await db
    .select({
      menu: places.menu,
      pedidosWhatsapp: places.pedidosWhatsapp,
      whatsapp: places.whatsapp,
    })
    .from(places)
    .where(eq(places.id, negocioId))
    .limit(1);

  /* Los mismos tres síes que decide la carta al montar el carrito: el plan, el
     interruptor del dueño y un número al que mandar el pedido. Comprobar aquí
     algo distinto dejaría pedidos que salen por WhatsApp y no llegan al
     historial, que es peor que no tener historial. */
  if (
    !place ||
    !place.pedidosWhatsapp ||
    !place.whatsapp?.trim() ||
    !(await tieneFuncion(negocioId, "whatsapp_pedido"))
  ) {
    return NextResponse.json(
      { error: "Este negocio no recibe pedidos." },
      { status: 409 },
    );
  }

  /* La carta es la que manda: cada línea tiene que apuntar a un producto de
     hoy. Se acepta también por nombre porque las entradas viejas no tienen
     `id` y el suyo se calcula con la posición. Así un carrito guardado antes de
     reordenar el menú no se queda fuera del historial. */
  const ids = new Set<string>();
  const nombres = new Set<string>();
  for (const [indice, item] of (place.menu ?? []).entries()) {
    ids.add(item.id ?? `${item.name}-${indice}`);
    nombres.add(normalizar(item.name));
  }
  if (lineas.some((linea) => !ids.has(linea.id) && !nombres.has(normalizar(linea.name)))) {
    return NextResponse.json(
      { error: "Hay un producto que ya no está en la carta." },
      { status: 400 },
    );
  }

  const idCliente =
    typeof body.id === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(body.id)
      ? body.id
      : generateId();

  await db
    .insert(pedidos)
    .values({
      id: idCliente,
      placeId: negocioId,
      lineas,
      direccion: texto(body.direccion, MAX_DIRECCION),
    })
    /* Reintento del mismo clic: la fila ya está y no se duplica. */
    .onConflictDoNothing({ target: pedidos.id });

  return NextResponse.json({ ok: true });
}

/** Los últimos pedidos del negocio. Solo su dueño o un administrador. */
export async function GET(req: NextRequest) {
  const placeId = (req.nextUrl.searchParams.get("placeId") ?? "")
    .trim()
    .slice(0, 64);
  if (!placeId) {
    return NextResponse.json({ error: "Falta el negocio." }, { status: 400 });
  }
  if (!(await canManagePlace(req, placeId, "pedidos"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  /* El fixture no tiene pedidos guardados; su plan sí se puede resolver. */
  const puede = await tieneFuncion(placeId, "whatsapp_pedido");
  if (placeId === DEV_PLACE_ID) return NextResponse.json({ pedidos: [], puede });

  const filas = await db
    .select({
      id: pedidos.id,
      lineas: pedidos.lineas,
      direccion: pedidos.direccion,
      estado: pedidos.estado,
      createdAt: pedidos.createdAt,
    })
    .from(pedidos)
    .where(eq(pedidos.placeId, placeId))
    .orderBy(desc(pedidos.createdAt))
    .limit(100);

  return NextResponse.json({ pedidos: filas, puede });
}

/** Marca un pedido como completado o cancelado. Solo el dueño. */
export async function PATCH(req: NextRequest) {
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const body = (cuerpo ?? {}) as Record<string, unknown>;
  const placeId =
    typeof body.placeId === "string" ? body.placeId.trim().slice(0, 64) : "";
  const id = typeof body.id === "string" ? body.id.trim().slice(0, 64) : "";
  const estado = body.estado;

  if (!placeId || !id || !esEstado(estado)) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  if (!(await canManagePlace(req, placeId, "pedidos"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (placeId === DEV_PLACE_ID) return NextResponse.json({ ok: true });

  await db
    .update(pedidos)
    .set({ estado })
    /* Las dos condiciones en **un solo** `where`: encadenar dos los reemplaza y
       dejaría cambiar el pedido de otro negocio conociendo su id. */
    .where(and(eq(pedidos.id, id), eq(pedidos.placeId, placeId)));

  return NextResponse.json({ ok: true });
}
