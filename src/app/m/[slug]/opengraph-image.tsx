import { ImageResponse } from "next/og";
import { getPlaceBySlug } from "@/lib/db/queries";
import { DEV_PLACE_ID } from "@/lib/dev-place";
import { siteConfig } from "@/config/site";

/**
 * La tarjeta que enseñan WhatsApp, Telegram o Instagram bajo el enlace de una
 * carta. Es la del **negocio**, no la de La Verde: quien la comparte está
 * repartiendo su propio menú, y una tarjeta con la marca de la plataforma no le
 * dice nada a quien la recibe.
 *
 * Hace falta un archivo propio porque la tarjeta raíz (`src/app/opengraph-image.tsx`)
 * se heredaba hasta aquí. En `generateMetadata` de `page.tsx` solo se declara
 * `images` **cuando el negocio tiene logo o foto**; sin ninguna de las dos, la
 * clave no existía y Next heredaba la tarjeta de La Verde —o, según la versión,
 * ninguna—. Con este archivo, el segmento resuelve siempre su propia imagen.
 *
 * Sin logo se pinta el nombre en grande: un negocio recién dado de alta todavía
 * no ha subido uno, y la tarjeta igual tiene que identificarlo.
 *
 * El logo se incrusta como data URI y **solo si es PNG o JPEG**. Satori no
 * entiende WebP —y los logos se suben en WebP, ver `src/lib/storage/compress.ts`—
 * así que un WebP aquí reventaría el render y la carta se quedaría sin imagen
 * para todos; en ese caso se cae a la inicial. La tarjeta con foto sí sale del
 * logo real, porque cuando el negocio tiene logo `generateMetadata` declara la
 * URL directa y esta imagen no llega a usarse.
 */
export const alt = "Menú del negocio en La Verde";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** El logo, en línea, si de verdad se puede pintar. */
async function logoEnLinea(url: string | undefined | null) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const tipo = res.headers.get("content-type") ?? "";
    if (!/^image\/(png|jpe?g)$/.test(tipo)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    /* Un logo de más de 1,5 MB no es un logo, es una foto: se pinta la inicial. */
    if (bytes.byteLength > 1_500_000) return null;
    return `data:${tipo};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug, {
    includeDev: slug === DEV_PLACE_ID,
  }).catch(() => null);

  const nombre = place?.name ?? "Menú";
  const donde = place?.city || place?.barrio || "Cuba";
  const pie = place ? `${place.category} · ${donde}` : donde;
  const logo = await logoEnLinea(place?.logoUrl);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F6F3EC",
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
          <div
            style={{
              width: 168,
              height: 168,
              borderRadius: 84,
              background: "#0A3D26",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} width={168} height={168} alt="" />
            ) : (
              <div style={{ fontSize: 84, fontWeight: 700, color: "#8FD4AC" }}>
                {nombre.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div
              style={{
                fontSize: 76,
                lineHeight: 1.06,
                fontWeight: 700,
                color: "#08130D",
                letterSpacing: "-0.02em",
                maxWidth: 800,
              }}
            >
              {nombre}
            </div>
            <div style={{ fontSize: 32, color: "#3A4A40", marginTop: 16 }}>
              {pie}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div
            style={{
              fontSize: 54,
              fontWeight: 700,
              color: "#0A3D26",
              letterSpacing: "-0.02em",
            }}
          >
            Menú y precios
          </div>
          <div style={{ fontSize: 28, color: "#3A4A40" }}>
            Pide por WhatsApp desde la carta.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            alignSelf: "flex-start",
            background: "rgba(53, 175, 109, 0.16)",
            border: "2px solid rgba(53, 175, 109, 0.45)",
            borderRadius: 999,
            padding: "14px 32px",
            fontSize: 26,
            fontWeight: 600,
            color: "#0A3D26",
          }}
        >
          {new URL(siteConfig.url).hostname}
        </div>
      </div>
    ),
    size,
  );
}
