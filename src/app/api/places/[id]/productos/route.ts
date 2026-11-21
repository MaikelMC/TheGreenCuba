import { NextRequest, NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { canManagePlace } from "@/lib/admin-server";
import { avisarNovedadesDeNegocio } from "@/lib/avisos-app-server";
import { DEV_PLACE_ID } from "@/lib/dev-place";
import { CAMPOS_PANEL, type OperacionesCatalogo } from "@/lib/catalogo";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { cambiosDeCarta } from "@/lib/novedades";
import { productosDe } from "@/lib/productos-server";
import { aplicarCatalogo } from "@/lib/productos-escritura";
import { avisosPorCambios } from "@/lib/seguidores";
import { avisarCambios } from "@/lib/seguidores-server";
import type { UserPlaceMenuItem } from "@/lib/places-store";

type Params = { params: Promise<{ id: string }> };

/**
 * El guardado del catálogo desde el panel, producto a producto (fase C).
 *
 * El panel ya no manda la carta entera: manda lo que cambió desde la última
 * vez que la leyó (`diferenciasCatalogo`) —altas, cambios con la versión que
 * tenía cada producto, bajas y el orden—. Lo que choca con la versión vuelve
 * como conflicto con el producto actual, y el panel avisa «Este producto cambió
 * desde el móvil» en vez de pisarlo.
 *
 * Quien puede: `canManagePlace` con el permiso de catálogo. Las reglas del
 * plan, el precio numérico y la caché los aplica `aplicarCatalogo`.
 *
 * Los avisos salen de aquí y no de `aplicarCatalogo`: esta ruta es el guardado
 * normal del dueño, y es la que debe avisar a quien marcó «Avísame» —bandeja y
 * push— y a los seguidores de Telegram. Las importaciones y los cambios
 * masivos del asistente escritos por la misma función no avisan (o el aviso ya
 * lo da el propio bot). La comparación antes/después usa la misma
 * `cambiosDeCarta` que el PATCH de la ficha, para que un alta o un precio
 * nuevo cuenten igual venga de donde venga.
 */

const MAX_OPERACIONES = 2000;
const MAX_TEXTO = 2000;

/** Solo los campos que el panel edita, con tipos sanos. */
function campos(valor: unknown): Partial<UserPlaceMenuItem> | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const salida: Record<string, unknown> = {};
  for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
    if (clave === "id" || !CAMPOS_PANEL.has(clave)) continue;
    if (v === null) salida[clave] = null;
    else if (clave === "agotadoHasta") {
      if (typeof v === "number" && Number.isFinite(v)) salida[clave] = v;
    } else if (clave === "oculto") {
      if (typeof v === "boolean") salida[clave] = v;
    } else if (clave === "disponibilidad") {
      if (v === "agotado" || v === "disponible") salida[clave] = v;
    } else if (typeof v === "string") {
      salida[clave] = v.slice(0, MAX_TEXTO);
    }
  }
  return salida as Partial<UserPlaceMenuItem>;
}

function texto(valor: unknown, max = 120): string {
  return typeof valor === "string" ? valor.trim().slice(0, max) : "";
}

function leerOperaciones(cuerpo: unknown): OperacionesCatalogo | null {
  if (!cuerpo || typeof cuerpo !== "object") return null;
  const c = cuerpo as Record<string, unknown>;
  const lista = (v: unknown) => (Array.isArray(v) ? v : []);

  const crear: OperacionesCatalogo["crear"] = [];
  for (const entrada of lista(c.crear)) {
    const e = (entrada ?? {}) as Record<string, unknown>;
    const item = campos(e.item);
    if (!item || !texto(item.name, MAX_TEXTO)) return null;
    crear.push({
      idTemporal: texto(e.idTemporal),
      item: {
        name: "",
        description: "",
        price: "",
        currency: "MLC",
        ...item,
      } as UserPlaceMenuItem,
    });
  }

  const actualizar: OperacionesCatalogo["actualizar"] = [];
  for (const entrada of lista(c.actualizar)) {
    const e = (entrada ?? {}) as Record<string, unknown>;
    const id = texto(e.id);
    const cambios = campos(e.cambios);
    if (!id || !cambios) return null;
    actualizar.push({
      id,
      ...(Number.isInteger(e.version) ? { version: e.version as number } : {}),
      cambios,
    });
  }

  const borrar = lista(c.borrar).map((v) => texto(v)).filter(Boolean);
  const orden = Array.isArray(c.orden) ? c.orden.map((v) => texto(v)).filter(Boolean) : undefined;

  if (crear.length + actualizar.length + borrar.length + (orden?.length ?? 0) > MAX_OPERACIONES) {
    return null;
  }
  return { crear, actualizar, borrar, ...(orden ? { orden } : {}) };
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!(await canManagePlace(req, id, "catalogo"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  /* El negocio de prueba no tiene filas en `productos`: su carta es una copia
     personal que se sigue guardando con el PATCH de la ficha. */
  if (id === DEV_PLACE_ID) {
    return NextResponse.json(
      { error: "El negocio de prueba guarda su carta con el PATCH de la ficha." },
      { status: 400 },
    );
  }

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const ops = leerOperaciones(cuerpo);
  if (!ops) {
    return NextResponse.json(
      { error: "Los cambios del catálogo no tienen la forma esperada. Recarga e inténtalo otra vez." },
      { status: 400 },
    );
  }

  const cartaAntes = await productosDe(id);
  const resultado = await aplicarCatalogo(id, ops);
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }

  /* Los avisos van con `after()` y después de escribir: el dueño está guardando
     su carta, no esperando a que salga un push. `avisarNovedadesDeNegocio` e
     `avisarCambios` no lanzan nunca; un aviso que no sale no puede tumbar un
     guardado que sí entró. */
  const { productosNuevos, cambiosPrecio } = cambiosDeCarta(
    cartaAntes,
    resultado.productos,
  );
  if (productosNuevos.length > 0 || cambiosPrecio.length > 0) {
    const titulares = [
      ...productosNuevos.map((producto) => `Nuevo en la carta: ${producto.nombre}`),
      ...cambiosPrecio.map((producto) => `${producto.nombre} cambió de precio`),
    ];

    after(async () => {
      try {
        const [lugar] = await db
          .select({
            name: places.name,
            province: places.province,
            city: places.city,
            isActive: places.isActive,
          })
          .from(places)
          .where(eq(places.id, id))
          .limit(1);
        if (!lugar) return;

        await avisarNovedadesDeNegocio({
          negocioId: id,
          nombre: lugar.name,
          provincia: lugar.province?.trim() || lugar.city?.trim() || null,
          titulares,
          visible: lugar.isActive,
        });

        /* Telegram solo habla de lo que `avisosPorCambios` contempla:
           productos nuevos. Un cambio de precio se queda en la bandeja y el
           push, como ya pasaba al guardar la ficha por el PATCH. */
        if (productosNuevos.length > 0) {
          const avisos = avisosPorCambios({
            negocio: lugar.name,
            ofertasNuevas: [],
            productosNuevos: productosNuevos.map((producto) => producto.nombre),
            reabre: false,
          });
          if (avisos.length > 0) await avisarCambios(id, avisos);
        }
      } catch (error) {
        console.error(
          "[catalogo] no se pudieron avisar los cambios:",
          error instanceof Error ? error.message : error,
        );
      }
    });
  }

  return NextResponse.json({
    creados: resultado.creados,
    conflictos: resultado.conflictos,
    productos: resultado.productos,
  });
}
