import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { places, publicaciones } from "@/lib/db/schema";
import { toPublicacion, type Publicacion } from "@/lib/db/mappers";
import { siteConfig } from "@/config/site";
import { semanaDe, type EstadoPublicacion } from "@/lib/publicaciones";
import { limite, puede } from "@/lib/plans-server";
import { generateId } from "@/lib/utils";

/**
 * Encolar una publicación, del lado del servidor.
 *
 * Vivía entero dentro de la ruta de administración. Al abrir la función al
 * negocio —que se encola desde su panel— la comprobación del plan, el reparto de
 * plaza y el `INSERT` pasan a ser los mismos para los dos caminos, y aquí no se
 * pueden separar: son justo las reglas que hay que aplicar igual venga la
 * petición de donde venga. Lo que queda en cada ruta es solo quién puede llamar.
 *
 * Quien decide **quién** puede encolar no es esto: la ruta comprueba antes que
 * el negocio sea de quien llama (`canManagePlace`). Esto solo dice si el plan
 * del negocio lo permite y si cabe en el tope de la semana.
 */

/** Enlace a la ficha pública: la llamada a la acción que va dentro del post. */
export function enlacePerfilDe(negocioId: string): string {
  return `${siteConfig.url.replace(/\/+$/, "")}/place/${negocioId}`;
}

export type ResultadoEncolar =
  | { ok: true; publicacion: Publicacion }
  | { ok: false; error: string; status: number };

/**
 * Mete una publicación en la cola de la semana, o explica por qué no cabe.
 *
 * El tope cuenta **todos** los estados: un borrador ocupa plaza igual que una
 * publicada, porque lo que el plan vende es el sitio. La semana la pone el
 * servidor: el cliente no elige a qué semana pertenece su publicación.
 *
 * El recuento no es lo que impone el tope, solo lo explica: quien lo impone es el
 * `unique` por plaza de la tabla, que es lo único que aguanta dos altas a la vez.
 */
export async function encolarPublicacion(
  negocioId: string,
  contenido: { texto: string; imagenUrl: string | null },
  estado: EstadoPublicacion = "borrador",
): Promise<ResultadoEncolar> {
  const [place] = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.id, negocioId))
    .limit(1);
  if (!place) {
    return { ok: false, error: "Negocio no encontrado", status: 404 };
  }

  /* Primero el permiso, después el tope. El tope solo no basta: en Gratis es 0 y
     el aviso saldría como «permite 0 publicaciones», que no explica nada. */
  if (!(await puede(negocioId, "publicaciones_fb"))) {
    return {
      ok: false,
      error:
        "Las publicaciones de Facebook están disponibles en los planes Básico y Pro.",
      status: 403,
    };
  }

  const semana = semanaDe(new Date());
  const tope = await limite(negocioId, "publicaciones_semana");

  /* La **plaza** que va a ocupar, en `[0, tope)`. Plaza y no «cuántas hay»: un
     hueco que dejó un borrado se reutiliza, así que se pregunta qué índice está
     libre y no cuántas filas hay —con dos filas y una borrada, «hay 1» diría que
     cabe en la plaza 1, que ya está ocupada—. Se lee antes de insertar y el
     índice único de la tabla cierra la carrera: si entre esta lectura y el
     INSERT otra petición ocupó la plaza, el conflicto para el alta y se responde
     409. Sin él, dos altas a la vez leían el mismo hueco y las dos entraban. */
  const usados = new Set(
    (
      await db
        .select({ orden: publicaciones.orden })
        .from(publicaciones)
        .where(
          and(
            eq(publicaciones.negocioId, negocioId),
            eq(publicaciones.semana, semana),
          ),
        )
    ).map((fila) => fila.orden),
  );

  let orden = -1;
  if (tope === null) {
    /* Sin tope configurado: cualquier plaza vale, y la siguiente libre es «las
       que hay». Hoy `publicaciones_semana` nunca es `null`, pero el tipo lo
       admite y una rama de más es mejor que un `!`. */
    orden = usados.size;
  } else {
    for (let plaza = 0; plaza < tope; plaza += 1) {
      if (!usados.has(plaza)) {
        orden = plaza;
        break;
      }
    }
  }
  if (orden < 0) {
    const palabra = tope === 1 ? "publicación" : "publicaciones";
    return {
      ok: false,
      error: `El plan permite ${tope} ${palabra} por semana y ya están en cola. Espera a la semana que viene o sube de plan.`,
      status: 400,
    };
  }

  const [row] = await db
    .insert(publicaciones)
    .values({
      id: generateId(),
      negocioId,
      texto: contenido.texto,
      imagenUrl: contenido.imagenUrl,
      estado,
      semana,
      orden,
    })
    .onConflictDoNothing({
      target: [
        publicaciones.negocioId,
        publicaciones.semana,
        publicaciones.orden,
      ],
    })
    .returning();

  if (!row) {
    /* Había plaza —`orden` no salió negativo—, así que el alta no entró porque
       otra petición se llevó esa misma plaza entre la lectura y el INSERT. Es
       raro —dos clics a la vez— y se resuelve reintentando. */
    return {
      ok: false,
      error: "Otra publicación ocupó la plaza a la vez. Inténtalo de nuevo.",
      status: 409,
    };
  }

  return { ok: true, publicacion: toPublicacion(row) };
}
