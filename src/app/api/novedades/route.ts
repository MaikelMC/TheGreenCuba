import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, gte, inArray, lte } from "drizzle-orm";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { db } from "@/lib/db";
import {
  categories,
  novedades,
  ofertas,
  places,
  suscripciones,
} from "@/lib/db/schema";
import { haversineM } from "@/lib/map/routing";
import {
  DIAS_NOVEDAD,
  MAX_NOVEDADES,
  MAX_POR_NEGOCIO,
  RADIO_CERCA_M,
  type NovedadHome,
} from "@/lib/novedades";
import { precioConOferta } from "@/lib/ofertas";
import { aSuscripcion, funcionesDe } from "@/lib/plans";
import { placeInUserProvince } from "@/lib/user-province";
import type { UserPlaceOferta } from "@/lib/places-store";

/**
 * Ofertas y novedades de los negocios de pago cerca del usuario.
 *
 * Público y sin sesión: lo que se enseña ya es público en la ficha del negocio.
 * Entran **solo** los negocios verificados por administración y con algo de pago
 * activo (pack, módulo suelto o prueba Pro); el filtro de plan se hace aquí y no
 * en el cliente, que no puede decidirlo.
 *
 * `lat`/`lng` son opcionales. Con coordenadas entra lo que está a menos de
 * `RADIO_CERCA_M` **o** en la provincia del usuario; con solo provincia, lo de
 * la provincia; sin ninguna de las dos, la respuesta es vacía.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  /* `Number(null)` es 0 y un (0, 0) inventado pasaría por coordenada válida.
     Por eso se comprueba que el parámetro exista antes de convertirlo. */
  const rawLat = searchParams.get("lat");
  const rawLng = searchParams.get("lng");
  const lat = rawLat === null ? Number.NaN : Number(rawLat);
  const lng = rawLng === null ? Number.NaN : Number(rawLng);
  const hayCoords =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;
  const provincia = searchParams.get("provincia")?.trim() || null;

  if (!hayCoords && !provincia) return respuesta([]);

  const ahora = new Date();
  const cat = await cargarCatalogo();

  const filas = await db
    .select({
      id: places.id,
      name: places.name,
      slug: places.slug,
      lat: places.lat,
      lng: places.lng,
      city: places.city,
      province: places.province,
      logoUrl: places.logoUrl,
      imageUrls: places.imageUrls,
      menu: places.menu,
      categoria: categories.name,
      plan: suscripciones.plan,
      estado: suscripciones.estado,
      trialHasta: suscripciones.trialHasta,
      venceEn: suscripciones.venceEn,
      modulos: suscripciones.modulos,
    })
    .from(places)
    .leftJoin(categories, eq(categories.id, places.categoryId))
    .leftJoin(suscripciones, eq(suscripciones.negocioId, places.id))
    .where(
      and(
        eq(places.isActive, true),
        eq(places.status, "active"),
        eq(places.verificado, true),
      ),
    );

  /* Verificado **y** de pago. `funcionesDe` siempre devuelve al menos las
     funciones de Gratis; si no añade ninguna, el negocio no ha contratado nada
     y no entra. La prueba Pro cuenta como pago mientras esté viva. */
  const incluidos: {
    fila: (typeof filas)[number];
    distanciaM?: number;
  }[] = [];

  for (const fila of filas) {
    const suscripcion = fila.plan
      ? aSuscripcion({
          plan: fila.plan,
          estado: fila.estado ?? "activa",
          trialHasta: fila.trialHasta,
          venceEn: fila.venceEn,
          modulos: fila.modulos ?? [],
        })
      : null;
    if (funcionesDe(suscripcion, ahora, cat).size <= cat.gratis.length) continue;

    if (hayCoords) {
      const distanciaM = haversineM(
        { lat, lng },
        { lat: fila.lat, lng: fila.lng },
      );
      if (distanciaM <= RADIO_CERCA_M) {
        incluidos.push({ fila, distanciaM });
      } else if (provincia && placeInUserProvince(fila, provincia)) {
        incluidos.push({ fila, distanciaM });
      }
    } else if (provincia && placeInUserProvince(fila, provincia)) {
      incluidos.push({ fila });
    }
  }

  if (incluidos.length === 0) return respuesta([]);

  const ids = incluidos.map(({ fila }) => fila.id);
  const desde = new Date(ahora.getTime() - DIAS_NOVEDAD * 86_400_000);

  const [ofertasVivas, cambios] = await Promise.all([
    db
      .select()
      .from(ofertas)
      .where(
        and(
          inArray(ofertas.negocioId, ids),
          lte(ofertas.inicia, ahora),
          gt(ofertas.termina, ahora),
        ),
      ),
    db
      .select()
      .from(novedades)
      .where(
        and(
          inArray(novedades.negocioId, ids),
          gte(novedades.createdAt, desde),
        ),
      ),
  ]);

  const porNegocio = new Map(incluidos.map((x) => [x.fila.id, x]));
  const items: NovedadHome[] = [];

  for (const oferta of ofertasVivas) {
    const incluido = porNegocio.get(oferta.negocioId);
    if (!incluido) continue;
    const { fila, distanciaM } = incluido;

    const producto = fila.menu?.find((p) => p.id === oferta.productoId);
    const comoOferta: UserPlaceOferta = {
      id: oferta.id,
      productoId: oferta.productoId,
      titulo: oferta.titulo,
      descripcion: oferta.descripcion ?? undefined,
      precioOferta: oferta.precioOferta ?? undefined,
      descuentoPct: oferta.descuentoPct ?? undefined,
      inicia: oferta.inicia.getTime(),
      termina: oferta.termina.getTime(),
    };
    const par = producto?.price
      ? precioConOferta(producto.price, comoOferta)
      : null;
    const precioAhora = par?.por ?? oferta.precioOferta ?? undefined;

    items.push({
      id: `oferta-${oferta.id}`,
      tipo: "oferta",
      titulo: oferta.titulo,
      texto: oferta.descripcion ?? undefined,
      negocioId: fila.id,
      negocioNombre: fila.name,
      negocioSlug: fila.slug,
      logoUrl: fila.logoUrl || undefined,
      categoria: fila.categoria ?? undefined,
      /* `||` y no `??`: un campo vacío es «no hay foto», no una URL válida. */
      imagenUrl:
        producto?.image || fila.imageUrls?.[0] || fila.logoUrl || undefined,
      productoId: oferta.productoId,
      productoNombre: producto?.name,
      /* Sin precio nuevo no hay nada que comparar: un porcentaje sobre un
         precio de texto libre («Desde 8») no se puede calcular. */
      precioAntes: precioAhora ? (par?.de ?? producto?.price) : undefined,
      precioAhora,
      distanciaM,
      createdAt: oferta.createdAt.getTime(),
      href: `/m/${fila.slug}`,
    });
  }

  for (const novedad of cambios) {
    const incluido = porNegocio.get(novedad.negocioId);
    if (!incluido) continue;
    const { fila, distanciaM } = incluido;

    items.push({
      id: novedad.id,
      tipo: novedad.tipo,
      titulo: novedad.titulo,
      texto: novedad.texto ?? undefined,
      negocioId: fila.id,
      negocioNombre: fila.name,
      negocioSlug: fila.slug,
      logoUrl: fila.logoUrl || undefined,
      categoria: fila.categoria ?? undefined,
      imagenUrl:
        novedad.imagenUrl || fila.imageUrls?.[0] || fila.logoUrl || undefined,
      productoId: novedad.productoId ?? undefined,
      productoNombre: novedad.productoNombre ?? undefined,
      precioAntes: novedad.precioAntes ?? undefined,
      precioAhora: novedad.precioAhora ?? undefined,
      distanciaM,
      createdAt: novedad.createdAt.getTime(),
      href:
        novedad.tipo === "actualizacion"
          ? `/place/${fila.id}`
          : `/m/${fila.slug}`,
    });
  }

  /* Cerca primero; entre lo que está a la misma distancia —o cuando solo se
     conoce la provincia—, lo más reciente delante. */
  items.sort((a, b) => {
    const da = a.distanciaM ?? Number.POSITIVE_INFINITY;
    const dbDist = b.distanciaM ?? Number.POSITIVE_INFINITY;
    if (da !== dbDist) return da < dbDist ? -1 : 1;
    return b.createdAt - a.createdAt;
  });

  /* Un negocio con veinte productos nuevos no puede tapar al resto. */
  const salida: NovedadHome[] = [];
  const cuenta = new Map<string, number>();
  for (const item of items) {
    if (salida.length >= MAX_NOVEDADES) break;
    const n = cuenta.get(item.negocioId) ?? 0;
    if (n >= MAX_POR_NEGOCIO) continue;
    cuenta.set(item.negocioId, n + 1);
    salida.push(item);
  }

  return respuesta(salida);
}

/**
 * Sesenta segundos de caché privada: la respuesta depende de la ubicación del
 * usuario, así que no puede compartirse entre visitantes.
 */
function respuesta(items: NovedadHome[]) {
  return NextResponse.json(items, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
