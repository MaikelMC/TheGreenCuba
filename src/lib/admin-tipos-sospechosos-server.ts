import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, places, productos } from "@/lib/db/schema";
import {
  detectarTiposSospechosos,
  type SospechaTipo,
} from "@/lib/admin-tipos-sospechosos";

/**
 * La lista de fichas con una categoría que no encaja con su nombre o su carta.
 *
 * La comparte el endpoint del panel de administración y el script que genera
 * el informe. No escribe nada: el admin decide, ficha por ficha.
 */
export async function listarTiposSospechosos(): Promise<SospechaTipo[]> {
  const filas = await db
    .select({
      id: places.id,
      name: places.name,
      category: categories.name,
    })
    .from(places)
    .leftJoin(categories, eq(categories.id, places.categoryId))
    .orderBy(places.name);

  const visibles = await db
    .select({
      placeId: productos.placeId,
      nombre: productos.nombre,
    })
    .from(productos)
    .where(eq(productos.oculto, false));

  const porLugar = new Map<string, string[]>();
  for (const producto of visibles) {
    const lista = porLugar.get(producto.placeId);
    if (lista) lista.push(producto.nombre);
    else porLugar.set(producto.placeId, [producto.nombre]);
  }

  return detectarTiposSospechosos(
    filas.map((fila) => ({
      id: fila.id,
      name: fila.name,
      category: fila.category ?? "Otro",
      productos: porLugar.get(fila.id) ?? [],
    })),
  );
}
