import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";

/**
 * La tarjeta que enseñan WhatsApp, Telegram o Instagram bajo un enlace
 * compartido: la vista previa del negocio.
 *
 * Vive aquí y no dentro de una ruta porque hay **dos** enlaces que se comparten
 * y tienen que enseñar lo mismo —la carta online (`/m/[slug]`) y la ficha del
 * lugar (`/place/[id]`)—, y cada uno resuelve su negocio por una clave distinta.
 * Duplicar el lienzo habría dejado dos tarjetas que se separan a la primera
 * vuelta.
 *
 * La marca que sale es la **del negocio**, nunca la de La Verde: quien comparte
 * está repartiendo su propia carta, y una tarjeta con la plataforma dentro no le
 * dice nada a quien la recibe.
 *
 * Satori pinta con estilos en línea: aquí no hay Tailwind ni variables CSS, solo
 * el lienzo. Los colores son los tokens del sistema a mano.
 */
export const OG_SIZE = { width: 1200, height: 630 };

/**
 * El logo, listo para incrustar, o `null`.
 *
 * Solo pasa PNG y JPEG: los logos se suben en WebP (`src/lib/storage/compress.ts`)
 * y satori no lo dibuja, así que un WebP aquí reventaría el render y dejaría la
 * carta sin imagen para todos. Sin logo se pinta la inicial, que siempre se
 * puede.
 *
 * Se incrusta como data URI —y no se le pasa la URL a satori para que la baje—
 * porque así el fallo es de esta función, con vuelta atrás, y no un error del
 * render.
 */
export async function logoEnLinea(url: string | undefined | null) {
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

export function tarjetaNegocio({
  nombre,
  pie,
  titular,
  subtitulo,
  logo,
}: {
  /** El nombre del negocio, que es lo que identifica la tarjeta. */
  nombre: string;
  /** Debajo del nombre: categoría y ciudad. */
  pie: string;
  /** La línea grande de abajo. */
  titular: string;
  /** Su apoyo, en una línea. */
  subtitulo: string;
  /** El data URI del logo, ya resuelto por `logoEnLinea`. */
  logo: string | null;
}) {
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
                {(nombre.trim()[0] ?? "?").toUpperCase()}
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

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 54,
              fontWeight: 700,
              color: "#0A3D26",
              letterSpacing: "-0.02em",
            }}
          >
            {titular}
          </div>
          <div style={{ fontSize: 28, color: "#3A4A40" }}>{subtitulo}</div>
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
    OG_SIZE,
  );
}
