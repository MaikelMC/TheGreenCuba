import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { catalogoPlanes, CATALOGO_ID } from "@/lib/db/schema";
import { cargarCatalogo, CATALOGO_TAG, normalizarCatalogo } from "@/lib/catalogo-server";
import { CATALOG_TAG } from "@/lib/db/queries";

/**
 * El catálogo de planes, para administración.
 *
 * Es la única puerta que escribe `catalogo_planes`, y escribe **una sola fila**:
 * el catálogo es uno para todo el sitio, no uno por negocio.
 *
 * Aquí no se crea ni se borra nada del catálogo. Las claves —qué funciones,
 * qué módulos, qué packs existen— son el vocabulario del código: `qr_sin_marca`
 * existe porque hay código detrás. Lo que se edita son sus **valores**: precios,
 * nombres, textos y qué trae cada módulo y cada pack.
 *
 * `normalizarCatalogo` es la frontera: lo que entre por aquí se convierte en un
 * catálogo que cumple el tipo, campo a campo, cayendo al valor de fábrica en
 * todo lo que no valide. Un `usd: "gratis"` o una clave de módulo inventada se
 * guardan, sí, pero se leen como el valor por defecto —y no pueden tumbar la
 * resolución de permisos de todo el sitio—.
 *
 * `isAdminRequest` acepta la sesión de administrador o la cabecera
 * `x-admin-key`, igual que el resto de rutas de administración.
 */

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return NextResponse.json({ catalogo: await cargarCatalogo() });
}

export async function PUT(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const catalogo = normalizarCatalogo(body);

  await db
    .insert(catalogoPlanes)
    .values({ id: CATALOGO_ID, datos: catalogo })
    .onConflictDoUpdate({
      target: catalogoPlanes.id,
      set: { datos: catalogo, updatedAt: new Date() },
    });

  /* Las dos etiquetas: la del catálogo de planes y la del catálogo de lugares.
     Un negocio lleva suscripción dentro de la ficha cacheada, así que cambiar
     un pack cambia también lo que esa ficha resuelve —y el `plan` que enseña el
     listado de administración—. Invalidar solo la primera dejaba fichas con el
     plan viejo hasta que caducara su caché. */
  revalidateTag(CATALOGO_TAG, "max");
  revalidateTag(CATALOG_TAG, "max");

  return NextResponse.json({ catalogo });
}
