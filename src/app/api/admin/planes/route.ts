import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { catalogoPlanes, CATALOGO_ID } from "@/lib/db/schema";
import { cargarCatalogo, CATALOGO_TAG, normalizarCatalogo } from "@/lib/catalogo-server";
import { invalidarCatalogo } from "@/lib/db/queries";

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

/**
 * La versión del catálogo guardado: su `updated_at` en ISO, o `null` si nunca se
 * guardó (rige el de fábrica). El editor la manda al guardar, en la cabecera
 * `x-version`, para no pisar lo que otro administrador guardó mientras tanto.
 */
async function versionGuardada(): Promise<string | null> {
  const [row] = await db
    .select({ updatedAt: catalogoPlanes.updatedAt })
    .from(catalogoPlanes)
    .where(eq(catalogoPlanes.id, CATALOGO_ID))
    .limit(1);
  return row?.updatedAt.toISOString() ?? null;
}

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [catalogo, version] = await Promise.all([cargarCatalogo(), versionGuardada()]);
  return NextResponse.json({ catalogo, version });
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

  /* El catálogo se guarda entero: sin comprobar versión, el segundo de dos
     administradores borraba en silencio lo que había guardado el primero. La
     condición va dentro del upsert (`setWhere`), sin carrera entre leer y
     escribir. `date_trunc` y `::timestamp` por lo mismo que en
     `api/admin/suscripciones`: `defaultNow()` guarda microsegundos y drizzle
     escribe el ISO en UTC. Sin cabecera (otro cliente, `x-admin-key`) no se
     comprueba, como antes. */
  const cabecera = req.headers.get("x-version");
  const esperado = cabecera ? new Date(cabecera) : null;
  if (esperado && Number.isNaN(esperado.getTime())) {
    return NextResponse.json({ error: "Versión del catálogo no válida." }, { status: 400 });
  }

  const escritas = await db
    .insert(catalogoPlanes)
    .values({ id: CATALOGO_ID, datos: catalogo })
    .onConflictDoUpdate({
      target: catalogoPlanes.id,
      set: { datos: catalogo, updatedAt: new Date() },
      ...(esperado
        ? {
            setWhere: sql`date_trunc('milliseconds', ${catalogoPlanes.updatedAt}) = ${esperado.toISOString()}::timestamp`,
          }
        : {}),
    })
    .returning({ updatedAt: catalogoPlanes.updatedAt });

  if (escritas.length === 0) {
    return NextResponse.json(
      {
        error:
          "Otro administrador guardó el catálogo mientras lo editabas. No se guardó nada: recarga la página y repite tus cambios.",
      },
      { status: 409 },
    );
  }

  /* Las dos etiquetas: la del catálogo de planes y la del catálogo de lugares.
     Un negocio lleva suscripción dentro de la ficha cacheada, así que cambiar
     un pack cambia también lo que esa ficha resuelve —y el `plan` que enseña el
     listado de administración—. Invalidar solo la primera dejaba fichas con el
     plan viejo hasta que caducara su caché. */
  await registrarActividad({
    accion: ACCION.editarPrecios,
    objetoTipo: "plan",
    objetoId: CATALOGO_ID,
    resumen: "Guardó el catálogo de planes y precios",
  });

  revalidateTag(CATALOGO_TAG, { expire: 0 });
  invalidarCatalogo();

  /* Se devuelve el catálogo **vivo**, no el normalizado: el editor tiene que
     ver la misma tasa de mercado que verá el panel, no la manual que acaba de
     guardar como respaldo. */
  return NextResponse.json({
    catalogo: await cargarCatalogo(),
    version: escritas[0]!.updatedAt.toISOString(),
  });
}
