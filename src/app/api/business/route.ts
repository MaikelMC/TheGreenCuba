import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { businessOwners, places, users } from "@/lib/db/schema";
import { toNewPlaceValues } from "@/lib/db/mappers";
import { CATALOG_TAG, resolveCategoryId } from "@/lib/db/queries";
import { generateId } from "@/lib/utils";
import type { UserPlace } from "@/lib/places-store";

/**
 * Alta del negocio desde el perfil.
 *
 * Es la puerta que faltaba: hasta ahora un usuario normal no tenía ninguna. El
 * camino que había era una lista de espera que nadie escribía —existían el
 * store, la API y la pantalla de administración, pero ningún formulario que la
 * llenara—, así que quien quería su negocio en La Verde no podía ni pedirlo.
 *
 * **Un negocio por persona.** No es una limitación técnica —`business_owners`
 * admite varias filas—, es que «Tengo un negocio» es singular y el panel enseña
 * uno. El día que haga falta más de uno, lo que cambia es esto y el panel, no
 * las tablas.
 *
 * **El negocio nace sin publicar** (`is_active = false`). `status` y `isActive`
 * parecen lo mismo y no lo son: `status` es lo que dice el dueño sobre si su
 * negocio está abierto ahora, e `isActive` es lo que dice el sistema sobre si la
 * ficha está publicada. Nace apagada y la enciende un administrador desde
 * `/admin/negocios`. Sin eso, cualquiera con cuenta podría meter una ficha falsa
 * y la vería todo el mundo al instante.
 */

/** Los campos que este formulario puede escribir, y ninguno más. */
function curatedInput(body: Partial<UserPlace>): Partial<UserPlace> {
  /* Lista blanca y no lista negra, y la diferencia importa: `toNewPlaceValues`
     vuelca el objeto que le llegue sobre la fila, así que pasarle el cuerpo tal
     cual dejaría al usuario escribir `isBoosted`, `boostExpiresAt`, `rating` o
     `aiTags` — campos que no son suyos—. El alta de administración sí pasa el
     cuerpo entero, y está bien: allí quien llama es de confianza. Aquí no. */
  const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
  const list = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, 20) : [];

  return {
    name: text(body.name),
    category: text(body.category),
    description: text(body.description),
    address: text(body.address),
    barrio: text(body.barrio),
    schedule: text(body.schedule),
    phone: text(body.phone) || undefined,
    lat: body.lat,
    lng: body.lng,
    payments: list(body.payments),
    vibe: list(body.vibe),
  };
}

export async function POST(req: NextRequest) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Partial<UserPlace>;
  try {
    body = (await req.json()) as Partial<UserPlace>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const input = curatedInput(body);

  if (!input.name) {
    return NextResponse.json({ error: "El nombre del negocio es obligatorio" }, { status: 400 });
  }
  /* El rango además de `isFinite`: esto viene del navegador y termina en un pin
     del mapa compartido. Un `lat` de 500 no revienta nada, simplemente sitúa el
     negocio en ningún sitio. */
  const lat = input.lat;
  const lng = input.lng;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return NextResponse.json(
      { error: "Marca tu negocio en el mapa: hacen falta coordenadas válidas." },
      { status: 400 },
    );
  }

  const categoryId = await resolveCategoryId(input.category);
  if (!categoryId) {
    return NextResponse.json(
      { error: `La categoría «${input.category ?? ""}» no existe.` },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ placeId: businessOwners.placeId })
    .from(businessOwners)
    .where(eq(businessOwners.userId, user.id))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "Ya tienes un negocio dado de alta." },
      { status: 409 },
    );
  }

  const placeId = generateId();

  /* **El orden importa: negocio, vínculo, rol.** Si se corta a mitad queda un
     negocio sin dueño —que un administrador puede reclamar desde el panel— pero
     nunca un `owner` sin negocio, que es el estado que rompe: `/business` busca
     el suyo y no lo encuentra. */
  await db.insert(places).values({
    ...toNewPlaceValues(input, categoryId, placeId),
    /* Después del volcado, para que ganen: `toNewPlaceValues` no toca ninguna de
       las dos, pero el orden deja claro quién manda si algún día lo hace. */
    isActive: false,
    createdBy: user.id,
  });

  await db.insert(businessOwners).values({
    id: generateId(),
    userId: user.id,
    placeId,
    role: "owner",
    /* Se acepta en el acto: quien rellena el formulario es quien lleva el
       negocio. El campo existe para las invitaciones, que no es este camino. */
    acceptedAt: new Date(),
  });

  if (user.role !== "owner") {
    await db
      .update(users)
      .set({ role: "owner", updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  /* El negocio nace sin publicar, así que el catálogo público no cambia. Se
     invalida igual: el panel de administración lo lee todo y tiene que verlo
     aparecer para poder aprobarlo. */
  revalidateTag(CATALOG_TAG, "max");

  return NextResponse.json({ id: placeId, name: input.name, isActive: false }, { status: 201 });
}
