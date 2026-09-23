import type { Metadata } from "next";
import { cache } from "react";
import { getPlaceById } from "@/lib/db/queries";
import { placeJsonLd, placeUrl } from "@/lib/structured-data";
import { PlaceView } from "./place-view";

/**
 * La ficha pública de un lugar.
 *
 * Esta página era un componente de cliente entero, y eso tenía una consecuencia
 * que no se veía en el navegador: sin JavaScript no había ficha. El servidor
 * mandaba el esqueleto vacío, el nombre del negocio lo ponía `usePlaces()` tras
 * hidratar, y un buscador que no ejecuta scripts —o que decide no gastar en
 * hacerlo— se encontraba una página sin nada que indexar. Las fichas son la
 * puerta de entrada orgánica del producto, así que esto era el problema más
 * caro de todos.
 *
 * La división queda así: aquí, en el servidor, se resuelve el lugar, se emite la
 * metadata y el marcado estructurado, y se pinta la vista con el dato dentro;
 * `place-view.tsx` se queda con lo que de verdad es interacción.
 */

/**
 * Una sola consulta por petición.
 *
 * `generateMetadata` y el componente piden el mismo lugar, y sin esto serían dos
 * viajes a Neon para la misma fila. `cache` de React deduplica dentro de la
 * petición, que es exactamente el alcance que hace falta.
 *
 * El `try` devuelve `null` en vez de propagar: si Neon no contesta —y desde esta
 * red eso pasa por rachas—, es mejor servir la ficha sin metadata que un error
 * en una URL que la gente comparte por WhatsApp.
 */
const getPlace = cache(async (id: string) => {
  try {
    return await getPlaceById(id);
  } catch {
    return null;
  }
});

function describe(place: {
  name: string;
  category: string;
  city?: string;
  barrio: string;
  description: string;
}): { title: string; description: string } {
  const where = place.city || place.barrio || "Cuba";
  return {
    title: `${place.name} — ${place.category} en ${where}`,
    /* La descripción larga se recorta: Google corta alrededor de los 160
       caracteres y lo que sobre no se lee, solo resta espacio a lo que sí. */
    description: place.description
      ? place.description.slice(0, 160)
      : `${place.name}, ${place.category} en ${where}. Dirección, horario, precios y métodos de pago en La Verde.`,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const place = await getPlace(id);

  /* Una URL que no corresponde a ningún negocio no se indexa: si entra en el
     índice, compite con las fichas buenas por las mismas consultas y no tiene
     nada que ofrecer a quien llegue. */
  if (!place) {
    return { title: "Lugar no encontrado", robots: { index: false, follow: true } };
  }

  const { title, description } = describe(place);
  const cover = place.photos?.[0]?.url;

  return {
    title,
    description,
    /* Relativa a propósito: la resuelve `metadataBase` contra la URL canónica
       del sitio, así que no puede quedarse apuntando a localhost ni a la
       preview de Vercel. */
    alternates: { canonical: `/place/${place.id}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: placeUrl(place.id),
      images: cover ? [cover] : undefined,
    },
    twitter: { card: "summary_large_image", title, description },
    /* Un negocio cerrado se enseña —el enlace está compartido y tiene que
       abrir—, pero no se ofrece al índice: es una página que dice «cerrado». */
    robots: place.status === "active" ? undefined : { index: false, follow: true },
  };
}

export default async function PlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const place = await getPlace(id);

  return (
    <>
      {place && (
        <script
          type="application/ld+json"
          /* Los datos del negocio los escribe su dueño desde el panel, así que
             el `<` se escapa antes de meterlos en la página: sin eso, un nombre
             con `</script>` dentro cierra la etiqueta y lo que venga detrás se
             ejecuta como HTML. */
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(placeJsonLd(place)).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <PlaceView id={id} initialPlace={place} />
    </>
  );
}
