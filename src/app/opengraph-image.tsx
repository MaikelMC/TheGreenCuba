import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";

/**
 * Tarjeta de Open Graph del sitio.
 *
 * Sustituye a un `ogImage: "/og.png"` que apuntaba a un archivo inexistente:
 * cada enlace compartido en WhatsApp o Instagram enseñaba una imagen rota. Se
 * genera aquí, con la convención de Next, así que se sirve con las cabeceras
 * correctas y aparece sola en el `og:image` de todas las páginas —cada ficha la
 * puede sustituir más adelante con la suya—.
 *
 * Los colores van a mano porque esto no es HTML del navegador: no hay Tailwind
 * ni variables CSS, solo estilos en línea dentro de un lienzo de 1200×630.
 */
export const alt = "La Verde — descubre lugares en Cuba";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#F6F3EC",
          padding: "80px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            fontSize: 34,
            color: "#35AF6D",
            letterSpacing: "-0.01em",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: "#CEEEDB",
            }}
          />
          La Verde
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 76,
            lineHeight: 1.1,
            color: "#08130D",
          }}
        >
          Descubre dónde ir en Cuba
        </div>
        <div style={{ marginTop: 28, fontSize: 32, color: "#4A5A52" }}>
          {siteConfig.description}
        </div>
      </div>
    ),
    size,
  );
}
