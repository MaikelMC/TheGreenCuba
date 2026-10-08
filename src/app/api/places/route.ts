import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { NEON_AUTH_SESSION_COOKIE_NAME } from "@neondatabase/auth/server";
import { isAdminRequest } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { places, projectRequests } from "@/lib/db/schema";
import { toNewPlaceValues, toUserPlace } from "@/lib/db/mappers";
import { CATALOG_TAG, listPlaces, resolveCategoryId } from "@/lib/db/queries";
import { canViewDevPlace } from "@/lib/dev-place";
import { crearSuscripcion } from "@/lib/plans-server";
import { generateId } from "@/lib/utils";
import type { UserPlace } from "@/lib/places-store";

/**
 * Lista y alta de negocios.
 *
 * Devuelve `UserPlace[]` ya traducido: el cliente no ve `snake_case`, ni `Date`,
 * ni `category_id`. La distancia no se ordena aquí — el catálogo es de una sola
 * ciudad y el home ya calcula su etiqueta en el navegador, que es donde está la
 * ubicación del usuario.
 *
 * Los parámetros `lat` y `lng` que aceptaba antes se han quitado: se leían y no
 * se usaban para nada, así que quien los mandaba creía estar ordenando por
 * cercanía y recibía el orden de la base.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  /* Quién pregunta, pero **solo para el negocio de prueba**: el catálogo se
     sirve igual a todo el mundo y esto no es una puerta.

     La sesión se lee únicamente si la petición trae la cookie de sesión. Sin
     ella no hay usuario que resolver, y preguntarlo de todos modos costaría una
     ida y vuelta al servidor de auth de Neon en **cada** carga del catálogo
     —y quien más lo carga es un anónimo, porque la ficha se comparte por
     WhatsApp y desde ella se pide esta ruta—. Con la cookie delante, la sesión
     va firmada dentro y se valida en memoria, sin salir a la red.

     El nombre de la cookie se importa y no se escribe a mano: es de Neon, no
     nuestro, y una copia literal dejaría de valer en cuanto el paquete lo
     cambie —en silencio, que es la peor forma—. */
  const email = req.cookies.has(NEON_AUTH_SESSION_COOKIE_NAME)
    ? (await getAppUser())?.email
    : null;

  const items = await listPlaces({
    city: searchParams.get("city"),
    categorySlug: searchParams.get("category"),
    /* **Solo lo publicado, por defecto.** Antes era al revés —sin `?active=true`
       devolvía todo— y el catálogo público enseñaba los negocios apagados: el
       home y el mapa piden esta ruta sin parámetros, así que un negocio que
       administración había cerrado seguía saliendo con su pin.

       Con el alta desde el perfil deja de ser un detalle: un negocio recién
       creado nace apagado, pendiente de aprobación, y con el defecto viejo
       habría aparecido en el mapa antes de que nadie lo mirara.

       El panel de administración lo necesita todo y por eso pide `?all=true`. */
    onlyActive: searchParams.get("all") !== "true",
    /* El pin del negocio de prueba, solo en el mapa de quien lo mantiene. Ver
       `dev-place.ts`. */
    includeDev: canViewDevPlace(email),
    limit: Number(searchParams.get("limit") ?? 200) || 200,
  });

  let approvedProjects: typeof projectRequests.$inferSelect[] = [];
  try {
    approvedProjects = await db
      .select()
      .from(projectRequests)
      .where(eq(projectRequests.status, "approved"));
  } catch (error) {
    /* La tabla llega con la migración de proyectos. Mientras un despliegue aún
       no la haya aplicado, los negocios normales deben seguir apareciendo. */
    console.error("[api/places] project_requests no disponible", error);
  }

  const projects = approvedProjects
    .filter((project) => !searchParams.get("category"))
    .map((project) => {
      const coverImageUrl = project.coverImageUrl ?? project.imageUrls[0] ?? null;
      const galleryUrls = [...new Set(project.imageUrls)].filter((url) => url !== coverImageUrl);
      const photos = [
        ...(coverImageUrl ? [{ url: coverImageUrl, alt: `Foto principal de ${project.name}`, width: null, height: null, isCover: true }] : []),
        ...galleryUrls
          .filter((url) => url !== coverImageUrl)
          .map((url, index) => ({ url, alt: `Foto ${index + 1} de ${project.name}`, width: null, height: null, isCover: false })),
      ];

      return {
        id: `project-${project.id}`,
        name: project.name,
        isProject: true,
        icon: "Sparkles",
        category: "Proyecto",
        lat: project.lat,
        lng: project.lng,
        address: project.venueName,
        barrio: project.venueName,
        city: project.provinces[0] ?? "Cuba",
        province: project.provinces[0] ?? "Cuba",
        description: project.description,
        offerPackages: project.offerPackages ?? [],
        photos,
        mapImageUrl: project.mapImageUrl ?? coverImageUrl ?? galleryUrls[0] ?? null,
        schedule: `${project.startsAt} a ${project.endsAt}`,
        payments: [],
        menu: [],
        offer: project.offers ? { text: project.offers, expiry: project.endsAt } : null,
        status: "active" as const,
        isActive: true,
        reviewStatus: "approved" as const,
        isBoosted: false,
        boostExpiresAt: "",
        createdAt: project.createdAt.getTime(),
        updatedAt: project.updatedAt.getTime(),
      };
    });

  return NextResponse.json([...items, ...projects]);
}

export async function POST(req: NextRequest) {
  /* Escribir sí exige sesión de administrador. Leer no: el catálogo es público,
     que es el producto. */
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Partial<UserPlace>;
  try {
    body = (await req.json()) as Partial<UserPlace>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  /* Validación en la frontera: esto viene del navegador y termina en un INSERT.
     `Number.isFinite` descarta `undefined`, `null`, `NaN` y las cadenas. */
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }
  if (!Number.isFinite(body.lat) || !Number.isFinite(body.lng)) {
    return NextResponse.json(
      { error: "Hacen falta coordenadas válidas: el negocio no se puede situar en el mapa." },
      { status: 400 },
    );
  }

  /* `category_id` es `notNull` y tiene clave foránea, así que una categoría
     inventada no se puede guardar. Mejor un 400 que explique qué pasa que un
     error de Postgres a medio camino. */
  const categoryId = await resolveCategoryId(body.category);
  if (!categoryId) {
    return NextResponse.json(
      { error: `La categoría «${body.category ?? ""}» no existe.` },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(places)
    .values(toNewPlaceValues(body, categoryId, generateId()))
    .returning();

  /* Misma regla que el alta del perfil: negocio nuevo, gratis con 30 días de
     Pro de prueba. Sin esto, una ficha creada desde el panel nacería gratis y
     sin prueba, y su dueño vería menos que quien se dio de alta solo. */
  await crearSuscripcion(row!.id);

  revalidateTag(CATALOG_TAG, "max");

  return NextResponse.json(
    toUserPlace({ ...row!, categoryName: body.category ?? null }),
    { status: 201 },
  );
}
