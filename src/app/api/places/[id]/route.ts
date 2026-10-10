import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { canManagePlace, isAdminRequest } from "@/lib/admin-server";
import { normalizarWhatsappCubano } from "@/lib/contact-links";
import { esEnergia } from "@/lib/energia";
import { esTipoReserva } from "@/lib/reserva";
import { avisosPorCambios } from "@/lib/seguidores";
import { avisarCambios } from "@/lib/seguidores-server";
import { getAppUser } from "@/lib/auth/user";
import { DEV_PLACE_ID } from "@/lib/dev-place";
import { saveDevPlaceOverride } from "@/lib/dev-place-server";
import { trackEvent } from "@/lib/analytics/events";
import { db } from "@/lib/db";
import { businessOwners, notifications, ofertas, places, users } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { validarOferta } from "@/lib/ofertas";
import { toPlaceValues, toUserPlace } from "@/lib/db/mappers";
import { CATALOG_TAG, getPlaceById, resolveCategoryId } from "@/lib/db/queries";
import { limite, puede } from "@/lib/plans-server";
import {
  notifyAdminsBusinessSubmission,
  notifyOwnerBusinessApproved,
  notifyOwnerBusinessRejected,
} from "@/lib/email";
import type {
  PlaceStatus,
  UserPlace,
  UserPlaceMenuItem,
  UserPlaceOferta,
} from "@/lib/places-store";

type Params = { params: Promise<{ id: string }> };

/**
 * La ficha como estaba antes del `PATCH`, para poder comparar.
 *
 * Es lo que separa «oferta nueva» de «la misma oferta reeditada» y «producto
 * nuevo» de «la carta que ya estaba». Se lee de una vez —las dos consultas en
 * paralelo— y solo cuando el cuerpo trae algo que puede disparar un aviso: el
 * guardado normal del horario no paga este viaje.
 */
async function leerFichaPrevia(id: string): Promise<{
  menu: UserPlaceMenuItem[];
  status: PlaceStatus;
  ofertaIds: Set<string>;
}> {
  const [filas, ofertasPrevias] = await Promise.all([
    db
      .select({ menu: places.menu, status: places.status })
      .from(places)
      .where(eq(places.id, id))
      .limit(1),
    db
      .select({ id: ofertas.id })
      .from(ofertas)
      .where(eq(ofertas.negocioId, id)),
  ]);

  /* `[0]` y no un destructuring directo: dentro de un `Promise.all` cada
     consulta resuelve a su lista de filas —una, por el `limit`—, no a la fila
     suelta. */
  const fila = filas[0];

  return {
    menu: fila?.menu ?? [],
    /* El respaldo no adivina nada: sin fila, el `update` de abajo responde 404 y
       no hay ningún aviso que mandar. */
    status: fila?.status ?? "active",
    ofertaIds: new Set(ofertasPrevias.map((f) => f.id)),
  };
}

/**
 * Los productos de la carta que antes no estaban.
 *
 * Se empareja por `id` cuando lo hay y por nombre cuando no: media carta se
 * guardó antes de que los productos tuvieran id, y comparar solo por id diría
 * que una carta vieja entera es nueva en el primer guardado. El precio de
 * emparejar por nombre es que renombrar un producto sin id cuenta como uno
 * nuevo; se acepta, porque el aviso de más solo molesta una vez.
 */
function nuevosProductos(
  menu: UserPlace["menu"] | undefined,
  previo: UserPlaceMenuItem[],
): string[] {
  if (!Array.isArray(menu)) return [];

  const antes = new Set(
    previo.map((p) => (p.id ?? p.name).trim().toLowerCase()),
  );
  const vistos = new Set<string>();
  const nuevos: string[] = [];

  for (const item of menu) {
    const nombre = item.name?.trim();
    if (!nombre) continue;
    const clave = (item.id ?? item.name).trim().toLowerCase();
    if (antes.has(clave) || vistos.has(clave)) continue;
    vistos.add(clave);
    nuevos.push(nombre);
  }

  return nuevos;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const place = await getPlaceById(id);
  if (!place) {
    return NextResponse.json(
      { error: "Negocio no encontrado" },
      { status: 404 },
    );
  }
  return NextResponse.json(place);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;

  /* El `id` se resuelve **antes** de la comprobación, y no después como estaba:
     `canManagePlace` necesita saber de qué negocio se habla para decidir. El
     dueño guarda su ficha desde el panel y es `owner`, no `admin`, así que la
     comprobación de antes le devolvía un 401 en cada guardado. */
  if (!(await canManagePlace(req, id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Partial<UserPlace>;
  try {
    body = (await req.json()) as Partial<UserPlace>;
  } catch {
    return NextResponse.json(
      { error: "Cuerpo JSON inválido" },
      { status: 400 },
    );
  }

  /* La energía de respaldo es una de cuatro cadenas, o nada. La columna es
     `text` sin restricción —drizzle no genera el `check` al declararla con
     `enum`—, así que esta es la única puerta que impide guardar un valor
     inventado. Cadena vacía o `null` significan «quítalo», que es lo que manda
     el formulario al elegir lo contrario; cualquier otra cosa es un 400 y no un
     silencio: un valor que se cae sin decir nada deja al dueño creyendo que
     guardó lo que escribió. Va antes de la rama del negocio de prueba para que
     el fixture reciba la misma comprobación. */
  /* `unknown` y no el tipo del campo, aunque el cast de arriba diga que ya es
     `EnergiaRespaldo`: el cuerpo viene del navegador y una cadena vacía —que el
     formulario manda al elegir lo contrario— es un valor que TypeScript no ve
     por ningún lado. Tratarlo como lo que es, un dato sin comprobar, es lo que
     hace que esta guarda siga teniendo sentido. */
  const energia: unknown = body.energiaRespaldo;
  if (energia !== undefined) {
    if (energia === null || energia === "") {
      body.energiaRespaldo = null;
    } else if (!esEnergia(energia)) {
      return NextResponse.json(
        { error: "La energía de respaldo no es uno de los valores válidos." },
        { status: 400 },
      );
    }
  }

  /* El interruptor de los pedidos es un booleano, y `Boolean("false")` es
     `true`: sin esta guarda, un cuerpo con `"false"` como cadena encendería lo
     que venía a apagar. Va antes de la rama del fixture para que el negocio de
     prueba reciba la misma comprobación. */
  if (
    body.pedidosWhatsapp !== undefined &&
    typeof body.pedidosWhatsapp !== "boolean"
  ) {
    return NextResponse.json(
      { error: "El interruptor de pedidos tiene que ser verdadero o falso." },
      { status: 400 },
    );
  }

  /* ── Reservas por WhatsApp ────────────────────────────────────────────
     Tres guardas de forma, las tres antes de la rama del negocio de prueba
     para que el fixture reciba lo mismo que una ficha real:

     1. `aceptaReservas` es booleano. Mismo motivo que los pedidos: sin esto,
        un cuerpo con `"false"` como cadena —que es `true`— enciende lo que
        venía a apagar.
     2. `tipoReserva` es una de las tres cadenas. La columna es `text` sin
        `check`, así que esta es la única puerta que impide guardar un tipo
        inventado que luego el botón no sabría pintar.
     3. El aforo es un entero positivo, o nada. `null` es «sin tope», que es
        distinto de `0` («no admite a nadie»), y por eso el vacío se acepta.

     Y el candado del plan: sin `reservas_whatsapp` (Pro) no se escribe nada de
     esto. El panel ya lo pinta bloqueado; esto es lo que impide que desde la
     consola alguien se encienda la función que no paga. */
  if (
    body.aceptaReservas !== undefined &&
    typeof body.aceptaReservas !== "boolean"
  ) {
    return NextResponse.json(
      { error: "El interruptor de reservas tiene que ser verdadero o falso." },
      { status: 400 },
    );
  }

  const tipoReserva: unknown = body.tipoReserva;
  if (tipoReserva !== undefined && !esTipoReserva(tipoReserva)) {
    return NextResponse.json(
      {
        error:
          "El tipo de reserva tiene que ser mesa, apartado o cita.",
      },
      { status: 400 },
    );
  }

  const aforo: unknown = body.aforoMaxPersonas;
  if (
    aforo !== undefined &&
    aforo !== null &&
    (!Number.isInteger(aforo) || (aforo as number) < 1 || (aforo as number) > 1000)
  ) {
    return NextResponse.json(
      { error: "El aforo tiene que ser un número entero de personas." },
      { status: 400 },
    );
  }

  /* El cupo del día lleva la misma guarda que el aforo: entero positivo o
     nada, porque `null` es «sin tope» y el `0` sería «no admite a nadie», que
     es un estado que no se ofrece. */
  const aforoDiario: unknown = body.aforoDiarioPersonas;
  if (
    aforoDiario !== undefined &&
    aforoDiario !== null &&
    (!Number.isInteger(aforoDiario) ||
      (aforoDiario as number) < 1 ||
      (aforoDiario as number) > 1000)
  ) {
    return NextResponse.json(
      { error: "El cupo diario tiene que ser un número entero de personas." },
      { status: 400 },
    );
  }

  if (
    body.plantillaReserva !== undefined &&
    body.plantillaReserva !== null &&
    typeof body.plantillaReserva !== "string"
  ) {
    return NextResponse.json(
      { error: "La plantilla de la reserva tiene que ser texto." },
      { status: 400 },
    );
  }

  const tocaReservas =
    body.aceptaReservas !== undefined ||
    body.tipoReserva !== undefined ||
    body.aforoMaxPersonas !== undefined ||
    body.aforoDiarioPersonas !== undefined ||
    body.plantillaReserva !== undefined;
  if (tocaReservas && !(await puede(id, "reservas_whatsapp"))) {
    return NextResponse.json(
      {
        error:
          "Las reservas por WhatsApp están disponibles en el plan Pro.",
      },
      { status: 403 },
    );
  }

  /* El negocio de prueba no tiene fila en `places`, así que su edición no es un
     `update` sino la copia personal del usuario (`place_overrides`). Va aquí,
     antes de toda la lógica de abajo, porque cada bloque siguiente consulta o
     escribe la tabla `places` y el fixture no está allí. `canManagePlace` ya ha
     dejado pasar solo a quien puede verlo. */
  if (id === DEV_PLACE_ID) {
    const user = await getAppUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const saved = await saveDevPlaceOverride(user.id, body);
    return NextResponse.json(saved);
  }

  /* Publicar es cosa de administración, y por eso se tira el campo si quien
     llama no lo es. `canManagePlace` deja pasar al dueño —tiene que poder
     corregir su ficha—, y el dueño que espera aprobación tiene la misma sesión
     que tendrá después: con esto fuera, un `PATCH {"isActive": true}` desde la
     consola se publicaba solo y la revisión no valía nada. El panel del dueño
     no manda ese campo, así que aquí no se pierde nada.

     `plan` va en el mismo saco y por la misma razón: lo elige el dueño **al
     darse de alta**, por `/api/business`, que es la que valida la lista de
     planes; desde aquí no. Hoy solo pinta una etiqueta en el panel, pero el día
     que un plan abra funciones de pago este es el `PATCH` que se regalaría el
     ascenso.

     `verificado` también: el sello lo pone la administración, y el dueño que lo
     mandara desde la consola se lo colgaría sin que nadie lo revisara. El
     formulario del admin —el único que lo escribe— sí pasa la comprobación.

     La comprobación va solo cuando alguno de los dos campos viene, que es el
     caso raro: la aprobación desde `/admin` y los scripts con `x-admin-key`. */
  if (
    (body.isActive !== undefined ||
      body.plan !== undefined ||
      body.reviewStatus !== undefined ||
      body.verificado !== undefined) &&
    !(await isAdminRequest(req))
  ) {
    delete body.isActive;
    delete body.plan;
    delete body.reviewStatus;
    delete body.verificado;
  }

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (name === "") {
    return NextResponse.json(
      { error: "El nombre no puede quedar vacío" },
      { status: 400 },
    );
  }
  if (body.lat !== undefined && !Number.isFinite(body.lat)) {
    return NextResponse.json({ error: "Latitud inválida" }, { status: 400 });
  }
  if (body.lng !== undefined && !Number.isFinite(body.lng)) {
    return NextResponse.json({ error: "Longitud inválida" }, { status: 400 });
  }

  /* Igual que en el alta: el WhatsApp se guarda normalizado (`+53XXXXXXXX`).
     Vacío vale —borrar el número es un dato—, y lo que no se entiende se
     rechaza en vez de guardarse, porque de ahí sale el enlace de los pedidos. */
  if (typeof body.whatsapp === "string" && body.whatsapp.trim()) {
    const numero = normalizarWhatsappCubano(body.whatsapp);
    if (!numero) {
      return NextResponse.json(
        {
          error:
            "El número de WhatsApp no parece cubano. Escríbelo como +53 5 123 4567.",
        },
        { status: 400 },
      );
    }
    body.whatsapp = numero;
  }

  /* El tope de productos, solo al **crecer**.
   *
   * Comparar contra el menú que ya había y no contra el tope a secas importa:
   * el formulario manda la carta entera en cada guardado, así que un negocio
   * que bajó de plan teniendo más productos de los que el plan permite no
   * podría guardar ni el horario. Se le deja como está y solo se le corta
   * cuando intenta añadir. */
  if (Array.isArray(body.menu)) {
    const tope = await limite(id, "productos_max");
    if (tope !== null && body.menu.length > tope) {
      const [actual] = await db
        .select({ menu: places.menu })
        .from(places)
        .where(eq(places.id, id))
        .limit(1);

      if (body.menu.length > (actual?.menu?.length ?? 0)) {
        return NextResponse.json(
          {
            error: `Tu plan permite hasta ${tope} productos en la carta. Quita alguno para guardar, o mejora tu plan.`,
          },
          { status: 400 },
        );
      }
    }
  }

  /* «Hoy hay» es una función de pago, y este `PATCH` escribe la carta entera: sin
     esto, un plan que no lo incluye podría cambiar la disponibilidad colando los
     campos en el guardado normal. En vez de rechazar el guardado entero —el
     dueño está corrigiendo un precio, no la disponibilidad—, se **conservan**
     los valores que ya había, emparejando por `id` y, para las entradas viejas
     sin id, por posición. El interruptor de verdad es `setDisponibilidad`, que
     sí comprueba el plan. */
  if (Array.isArray(body.menu) && !(await puede(id, "hoy_hay"))) {
    const [actual] = await db
      .select({ menu: places.menu })
      .from(places)
      .where(eq(places.id, id))
      .limit(1);
    const prev = actual?.menu ?? [];
    body.menu = body.menu.map((item, i) => {
      const before =
        (item.id ? prev.find((p) => p.id === item.id) : undefined) ?? prev[i];
      return {
        ...item,
        disponibilidad: before?.disponibilidad,
        agotadoHasta: before?.agotadoHasta,
      };
    });
  }

  /* Lo que había antes, una sola vez para los tres avisos. Se lee aquí, con los
     cambios de tipo ya filtrados y antes de tocar las ofertas —que es el único
     bloque de abajo que borra—, y solo si el cuerpo trae algo que avisa. */
  const previo =
    Array.isArray(body.ofertas) ||
    Array.isArray(body.menu) ||
    body.status !== undefined
      ? await leerFichaPrevia(id)
      : null;

  /* Las ofertas que se van a guardar y no estaban: son las que avisan. Se llena
     dentro del bloque de abajo y se lee al final, cuando ya se sabe que el
     guardado entró. */
  let ofertasNuevas: UserPlaceOferta[] = [];

  /* Las ofertas flash viven en su propia tabla, así que no pasan por
     `toPlaceValues` —que escribe columnas de `places`— y se guardan aquí
     aparte, igual que el menú. El panel manda la lista entera en cada guardado,
     así que se **reemplaza**: borrar las del negocio e insertar las que vienen.
     Los `id` son del cliente y estables, pero el `createdAt` se reescribe en
     cada guardado; no se enseña por ningún lado.

     ponytail: dos sentencias y no una transacción —que el driver HTTP de Neon
     no ofrece—. Si el proceso muere entre las dos, el negocio se queda sin
     ofertas y el panel lo dice al no recibir respuesta. */
  if (Array.isArray(body.ofertas)) {
    const limpias: UserPlaceOferta[] = [];
    for (const entrada of body.ofertas) {
      const resultado = validarOferta(entrada);
      if (typeof resultado === "string") {
        return NextResponse.json({ error: resultado }, { status: 400 });
      }
      limpias.push(resultado);
    }

    if (previo) {
      const ahora = Date.now();
      ofertasNuevas = limpias.filter(
        (o) => !previo.ofertaIds.has(o.id) && o.termina > ahora,
      );
    }

    /* Las comprobaciones de plan solo cuando queda alguna oferta, y esto no es
       un atajo: el panel manda la lista entera en **cada** guardado, así que un
       negocio en Gratis —cuyo tope es 0— no podría guardar ni el horario por
       llevar `ofertas: []` en el cuerpo. Vaciar la lista vale siempre; es el
       estado al que apunta bajar de plan. */
    if (limpias.length > 0) {
      /* Primero el permiso, después el tope. Los dos van juntos porque el tope
         solo no basta: en Gratis y Básico `ofertas_vigentes_max` es 0, y el
         dueño leería «tu plan permite hasta 0 ofertas», que no explica nada. */
      if (!(await puede(id, "ofertas_flash"))) {
        return NextResponse.json(
          { error: "Las ofertas flash están disponibles en el plan Pro." },
          { status: 403 },
        );
      }

      /* El tope cuenta las que **no han caducado**, no solo las vivas: una
         oferta programada para mañana ocupa el mismo sitio que una de hoy, y
         contarla aparte dejaría colar una lista entera de futuras. */
      const tope = await limite(id, "ofertas_vigentes_max");
      if (tope !== null) {
        const ahora = Date.now();
        const enPie = limpias.filter((o) => o.termina > ahora).length;
        if (enPie > tope) {
          return NextResponse.json(
            {
              error: `Tu plan permite ${tope} ofertas a la vez. Quita alguna o espera a que caduque.`,
            },
            { status: 400 },
          );
        }
      }
    }

    await db.delete(ofertas).where(eq(ofertas.negocioId, id));
    if (limpias.length > 0) {
      await db.insert(ofertas).values(
        limpias.map((o) => ({
          ...o,
          negocioId: id,
          descripcion: o.descripcion ?? null,
          precioOferta: o.precioOferta ?? null,
          descuentoPct: o.descuentoPct ?? null,
          /* Epoch en ms en el cliente, `Date` en la columna: el mapeo lo hace
             aquí porque esta es la única puerta de escritura. */
          inicia: new Date(o.inicia),
          termina: new Date(o.termina),
        })),
      );
    }
  }

  /* Solo se resuelve la categoría si el cuerpo la trae. Si no viene, `values`
     no toca `category_id` y la que tenía se queda. */
  let categoryId: string | null = null;
  if (body.category !== undefined) {
    categoryId = await resolveCategoryId(body.category);
    if (!categoryId) {
      return NextResponse.json(
        { error: `La categoría «${body.category}» no existe.` },
        { status: 400 },
      );
    }
  }

  const values = toPlaceValues(
    name === undefined ? body : { ...body, name },
    categoryId,
  );
  if (Object.keys(values).length === 0) {
    return NextResponse.json(
      { error: "No hay nada que actualizar" },
      { status: 400 },
    );
  }

  const [row] = await db
    .update(places)
    .set(values)
    .where(eq(places.id, id))
    .returning();
  if (!row) {
    return NextResponse.json(
      { error: "Negocio no encontrado" },
      { status: 404 },
    );
  }

  if (body.reviewStatus === "approved" && body.isActive === true) {
    const [owner] = await db
      .select({ userId: businessOwners.userId })
      .from(businessOwners)
      .where(eq(businessOwners.placeId, id))
      .limit(1);

    if (owner) {
      const [previous] = await db
        .update(notifications)
        .set({
          type: "business_approved",
          title: "Solicitud de negocio aprobada",
          message: `Tu negocio «${row.name}» fue aprobado y ya está publicado en La Verde.`,
          readAt: null,
        })
        .where(eq(notifications.placeId, id))
        .returning({ id: notifications.id });

      if (!previous) {
        await db.insert(notifications).values({
          id: generateId(),
          userId: owner.userId,
          type: "business_approved",
          title: "Solicitud de negocio aprobada",
          message: `Tu negocio «${row.name}» fue aprobado y ya está publicado en La Verde.`,
          placeId: id,
        });
      }

      // Email al propietario (best-effort)
      const [ownerUser] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, owner.userId))
        .limit(1);
      if (ownerUser?.email) {
        const placeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/place/${id}`;
        void notifyOwnerBusinessApproved({
          ownerEmail: ownerUser.email,
          businessName: row.name,
          placeUrl,
        });
      }
    }

    trackEvent({
      type: "business_approved",
      businessId: id,
      userId: owner?.userId ?? null,
    });
  }

  /* ── Los avisos a seguidores ────────────────────────────────────────────

     Se dispara al publicar una oferta flash, al añadir un producto a la carta o
     al volver a abrir. Qué merece un aviso lo decide `avisosPorCambios`, que es
     puro y está probado; aquí solo se junta lo que había con lo que llega.

     Va **fuera del camino de la respuesta** y después de escribir: el aviso
     sale por Telegram, y el dueño está guardando su ficha, no esperando a que
     salga. `avisarCambios` es quien comprueba el plan (Pro) y el tope de tres
     por semana, y no lanza nunca: un aviso que no sale no puede tumbar un
     guardado que sí entró. */
  if (previo) {
    const avisos = avisosPorCambios({
      negocio: row.name,
      ofertasNuevas: ofertasNuevas.map((o) => ({
        titulo: o.titulo,
        descripcion: o.descripcion,
      })),
      productosNuevos: nuevosProductos(body.menu, previo.menu),
      reabre: body.status === "active" && previo.status !== "active",
    });
    if (avisos.length > 0) void avisarCambios(id, avisos);
  }

  /* Antes de releer, y no después: `getPlaceById` está cacheado, así que sin
     invalidar primero devolvería la ficha vieja y el panel guardaría un cambio
     que no se ve. El orden importa. */
  revalidateTag(CATALOG_TAG, "max");

  /* La categoría puede haber cambiado: se relee para devolver la etiqueta nueva
     en vez de la que mandó el cliente, que podría ser otra. */
  const updated = await getPlaceById(id);
  return NextResponse.json(
    updated ?? toUserPlace({ ...row, categoryName: null }),
  );
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  let rejectionMessage = "";
  try {
    const body = (await req.json()) as { message?: unknown };
    if (typeof body.message === "string")
      rejectionMessage = body.message.trim().slice(0, 1000);
  } catch {
    /* DELETE sin cuerpo sigue siendo válido para las eliminaciones del panel. */
  }

  const [owner] = await db
    .select({ userId: businessOwners.userId })
    .from(businessOwners)
    .where(eq(businessOwners.placeId, id))
    .limit(1);

  const [place] = await db
    .select({ name: places.name, isActive: places.isActive })
    .from(places)
    .where(eq(places.id, id))
    .limit(1);

  if (owner && place && !place.isActive) {
    await db.insert(notifications).values({
      id: generateId(),
      userId: owner.userId,
      type: "business_rejected",
      title: "Solicitud de negocio rechazada",
      message:
        rejectionMessage ||
        `La solicitud de «${place.name}» fue revisada y no aprobada. Puedes corregir los datos y enviarla nuevamente.`,
      placeId: id,
    });

    // Email al propietario (best-effort)
    const [ownerUser] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, owner.userId))
      .limit(1);
    if (ownerUser?.email) {
      const resubmitUrl = `${process.env.NEXT_PUBLIC_APP_URL}/profile?seccion=negocio`;
      void notifyOwnerBusinessRejected({
        ownerEmail: ownerUser.email,
        businessName: place.name,
        reason: rejectionMessage || undefined,
        resubmitUrl,
      });
    }

    await db
      .update(places)
      .set({ reviewStatus: "rejected", isActive: false, updatedAt: new Date() })
      .where(eq(places.id, id));

    trackEvent({
      type: "business_rejected",
      businessId: id,
      userId: owner.userId,
    });

    revalidateTag(CATALOG_TAG, "max");
    return NextResponse.json({ id, rejected: true });
  }

  const [row] = await db
    .delete(places)
    .where(eq(places.id, id))
    .returning({ id: places.id });

  if (!row) {
    return NextResponse.json(
      { error: "Negocio no encontrado" },
      { status: 404 },
    );
  }

  revalidateTag(CATALOG_TAG, "max");

  return NextResponse.json({ id: row.id });
}
