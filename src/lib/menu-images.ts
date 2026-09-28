import type { UserPlaceMenuItem } from "@/lib/places-store";

/**
 * Borra del bucket las fotos de «Lo que ofrece» que un guardado acaba de retirar.
 *
 * El orden importa y es la razón de que esta función exista: la foto se sube en
 * cuanto se elige, pero `places.menu` —el jsonb donde vive su URL— solo cambia
 * cuando el formulario guarda. Borrar el objeto en el momento en que se quita o
 * se reemplaza en el editor dejaría la URL que sigue en la base apuntando a un
 * archivo que ya no existe, y la ficha pública enseñaría un hueco roto a quien
 * se marcha sin guardar.
 *
 * Al revés el fallo es invisible: guardar primero y limpiar después deja como
 * mucho un archivo de más en el bucket, que es lo que una subida abandonada deja
 * igualmente y no le importa a nadie.
 *
 * Se dispara sin esperar —`void`— porque es limpieza: si la petición se cae, el
 * usuario no tiene por qué enterarse ni reintentar un guardado que sí valió.
 */
export function pruneMenuImages(
  placeId: string,
  before: UserPlaceMenuItem[],
  after: UserPlaceMenuItem[],
): void {
  const kept = new Set(
    after.map((item) => item.image).filter((url): url is string => Boolean(url)),
  );
  /* `Set` porque dos productos pueden compartir URL: sin esto se mandaría el
     mismo borrado dos veces y la segunda contestaría 400. */
  const retired = new Set(
    before.map((item) => item.image).filter((url): url is string => Boolean(url)),
  );

  for (const url of retired) {
    if (kept.has(url)) continue;
    void fetch(`/api/places/${placeId}/menu-image?url=${encodeURIComponent(url)}`, {
      method: "DELETE",
    }).catch(() => {});
  }
}
