import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { canManagePlace } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { invalidarCatalogo } from "@/lib/db/queries";
import { DEV_PLACE_ID } from "@/lib/dev-place";
import { places } from "@/lib/db/schema";
import { limite } from "@/lib/plans-server";
import { generateId } from "@/lib/utils";
import {
  MAX_FILAS,
  parsearCatalogo,
  resumir,
  textoPrecio,
  validarFilas,
  type FilaCruda,
  type ProductoExistente,
} from "@/lib/importar-catalogo";
import type { UserPlaceMenuItem } from "@/lib/places-store";

type Params = { params: Promise<{ id: string }> };

/**
 * Importación de catálogo por CSV.
 *
 * La usan los dos paneles —el del negocio y el de administración—, así que vive
 * en la familia de rutas del negocio junto al resto de lo que escribe sobre una
 * ficha (`/api/places/[id]`). Quien puede es `canManagePlace`: el dueño del
 * negocio o un administrador. Antes estaba bajo `/api/admin/negocios/[id]` con
 * `isAdminRequest`, y eso dejaba al dueño sin poder subir su propia carta.
 *
 * Tres operaciones y ninguna más:
 *
 * - `POST` sin `accion` → **vista previa**. Parsea y valida, no escribe. Es lo
 *   que llena la tabla de la pantalla.
 * - `POST` con `accion: "confirmar"` → escribe. Revalida en el servidor, no se
 *   fía de los estados que manda el navegador, y comprueba el tope del plan
 *   **antes** de tocar nada.
 * - `DELETE` → deshace una importación concreta por su marca.
 *
 * **Una sola escritura.** La carta no es una tabla de productos sino el jsonb
 * `places.menu`, así que «insertar en lote» aquí es un único `update` que
 * reemplaza el array por el que había más los nuevos. Y eso es justo lo que
 * pedía el «todo o nada»: una sola sentencia, sin transacción que orquestar
 * —el driver HTTP de Neon no la ofrece—, no puede quedar a medias.
 *
 * Nada de IA y nada de polling: parsear y validar caben en esta petición.
 */

/** La carta del negocio, o `null` si el negocio no existe. */
async function menuDe(id: string): Promise<UserPlaceMenuItem[] | null> {
  const [fila] = await db
    .select({ menu: places.menu })
    .from(places)
    .where(eq(places.id, id))
    .limit(1);

  return fila ? (fila.menu ?? []) : null;
}

/** Los productos que ya hay, reducidos a lo que hace falta para el duplicado. */
function existentesDe(menu: UserPlaceMenuItem[]): ProductoExistente[] {
  return menu.map((m) => ({ nombre: m.name, categoria: m.category }));
}

/** El cuerpo de una fila que llega del navegador, saneado a cadenas. */
function filaCruda(valor: unknown, indice: number): FilaCruda {
  const f = (valor ?? {}) as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" ? v : "");
  const numero = typeof f.numero === "number" && Number.isFinite(f.numero)
    ? f.numero
    : indice + 1;

  return {
    numero,
    nombre: texto(f.nombre),
    categoria: texto(f.categoria),
    descripcion: texto(f.descripcion),
    precio: texto(f.precio),
    moneda: texto(f.moneda),
  };
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  /* El `id` primero: `canManagePlace` necesita saber de qué negocio se habla
     para decidir si quien llama es su dueño. */
  if (!(await canManagePlace(req, id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  /* El negocio de prueba no tiene fila en `places`: su carta es una copia
     personal por usuario. Importar ahí escribiría en una ficha que no existe. */
  if (id === DEV_PLACE_ID) {
    return NextResponse.json(
      { error: "El negocio de prueba no admite importación de catálogo." },
      { status: 400 },
    );
  }

  const menu = await menuDe(id);
  if (!menu) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const existentes = existentesDe(menu);
  /* El tope se lee una vez y sirve para las dos operaciones: la vista previa lo
     devuelve para avisar antes de pulsar, y el confirmar lo vuelve a aplicar en
     serio —nunca se da por bueno el aviso del navegador—. */
  const tope = await limite(id, "productos_max");

  /* ── Vista previa ─────────────────────────────────────────────────────── */
  if (body.accion !== "confirmar") {
    const texto = typeof body.texto === "string" ? body.texto : "";
    if (!texto.trim()) {
      return NextResponse.json({ error: "Pega un CSV o sube un archivo." }, { status: 400 });
    }

    const { filas, error } = parsearCatalogo(texto);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const validadas = validarFilas(filas, existentes);
    return NextResponse.json({
      filas: validadas,
      resumen: resumir(validadas),
      actuales: menu.length,
      tope,
    });
  }

  /* ── Confirmar ────────────────────────────────────────────────────────── */
  if (!Array.isArray(body.filas)) {
    return NextResponse.json({ error: "Faltan las filas que importar." }, { status: 400 });
  }

  const filas = body.filas.map(filaCruda);
  if (filas.length === 0) {
    return NextResponse.json({ error: "No hay filas que importar." }, { status: 400 });
  }
  if (filas.length > MAX_FILAS) {
    return NextResponse.json(
      { error: `El máximo por importación es ${MAX_FILAS} filas.` },
      { status: 400 },
    );
  }

  /* Se revalida entero y no se mira `estado` de lo que llegó: el navegador pudo
     editarlo. Los errores que queden se devuelven para que la pantalla los pinte
     otra vez en su sitio. */
  const validadas = validarFilas(filas, existentes);
  const conError = validadas.filter((f) => f.estado === "error");
  if (conError.length > 0) {
    return NextResponse.json(
      {
        error: `Hay ${conError.length} fila(s) con errores. Corrígelas para poder importar.`,
        filas: validadas,
        resumen: resumir(validadas),
      },
      { status: 400 },
    );
  }

  const nuevos = validadas.filter((f) => f.estado === "nuevo");
  if (nuevos.length === 0) {
    return NextResponse.json(
      { error: "No hay productos nuevos: todas las filas son duplicados." },
      { status: 400 },
    );
  }

  /* El tope del plan, y con el recado entero: cuántos hay, cuántos entran y
     cuántos sobran. Se corta **antes** de escribir, así que no se importa nada
     a medias — el «todo o nada» de la importación. */
  if (tope !== null && menu.length + nuevos.length > tope) {
    const sobran = menu.length + nuevos.length - tope;
    return NextResponse.json(
      {
        error: `El plan permite ${tope} productos y este negocio ya tiene ${menu.length}. Importar ${nuevos.length} se pasaría por ${sobran}. Quita al menos ${sobran} fila(s) o sube el plan: no se ha importado nada.`,
      },
      { status: 400 },
    );
  }

  const importacionId = generateId();
  const items: UserPlaceMenuItem[] = nuevos.map((f) => ({
    id: generateId(),
    name: f.nombre,
    description: f.descripcion,
    price: textoPrecio(f.precio),
    currency: f.moneda,
    category: f.categoria,
    /* La marca de la importación viaja dentro del propio producto. Es lo que
       hace posible deshacerla sin una columna nueva ni una tabla aparte. */
    importacionId,
  }));

  const [fila] = await db
    .update(places)
    .set({ menu: [...menu, ...items] })
    .where(eq(places.id, id))
    .returning({ id: places.id });

  if (!fila) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  /* El menú público del negocio se sirve desde esta etiqueta de caché: sin
     invalidarla, la carta nueva no se vería hasta que caducara sola. */
  invalidarCatalogo();

  return NextResponse.json(
    {
      importacionId,
      importados: items.length,
      resumen: resumir(validadas),
    },
    { status: 201 },
  );
}

/**
 * Deshacer una importación.
 *
 * Se borran los productos que llevan esa marca, y la forma de borrado es la
 * misma que usa el panel para cualquier producto: reescribir `menu` sin ellos.
 * La marca no se reutiliza —cada importación tiene la suya—, así que deshacer
 * una no toca lo que entró después ni en otra tanda.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!(await canManagePlace(req, id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const importacionId = new URL(req.url).searchParams.get("importacionId")?.trim() ?? "";
  if (!importacionId) {
    return NextResponse.json({ error: "Falta importacionId" }, { status: 400 });
  }

  const menu = await menuDe(id);
  if (!menu) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  const restante = menu.filter((m) => m.importacionId !== importacionId);
  if (restante.length === menu.length) {
    return NextResponse.json({ eliminados: 0 });
  }

  await db.update(places).set({ menu: restante }).where(eq(places.id, id));
  invalidarCatalogo();

  return NextResponse.json({ eliminados: menu.length - restante.length });
}
