import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { siteConfig } from "@/config/site";

/**
 * Tarjeta de Open Graph del sitio — la vista previa que enseñan WhatsApp,
 * Instagram, Telegram o iMessage bajo el enlace compartido.
 *
 * El logo es el mismo PNG que usa el sitio en sus cabeceras
 * (`public/logo.png`), embebido como data URI: satori —el motor que pinta
 * esta imagen— no pide archivos por ruta, y una URL pública añadiría una
 * petición de red al render para algo que ya está en el repo.
 *
 * Los colores van a mano porque esto no es HTML del navegador: no hay
 * Tailwind ni variables CSS, solo estilos en línea dentro de un lienzo de
 * 1200×630. Son los tokens del sistema: verde profundo del modo oscuro
 * (#06211A), el verde de marca (#35AF6D) y el arena del fondo claro
 * (#F6F3EC).
 */
export const alt = "La Verde — descubre lugares en Cuba";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logo = await readFile(path.join(process.cwd(), "public", "logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0A3D26 0%, #06211A 70%)",
          padding: "72px 80px",
        }}
      >
        {/* Marca: el logo real dentro de su ficha arena, como se ve en el sitio. */}
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <div
            style={{
              width: 132,
              height: 132,
              borderRadius: 36,
              background: "#F6F3EC",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} width={104} height={104} alt="" />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 58,
                fontWeight: 700,
                color: "#FFFFFF",
                letterSpacing: "-0.02em",
              }}
            >
              {siteConfig.name}
            </div>
            <div style={{ fontSize: 26, color: "#8FD4AC", marginTop: 6 }}>
              {siteConfig.slogan}
            </div>
          </div>
        </div>

        {/* Mensaje principal. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 78,
              lineHeight: 1.08,
              fontWeight: 700,
              color: "#FFFFFF",
              letterSpacing: "-0.02em",
              maxWidth: 900,
            }}
          >
            Descubre dónde ir en Cuba
          </div>
          <div style={{ marginTop: 26, fontSize: 32, color: "#D7E8DD", maxWidth: 880 }}>
            {siteConfig.description}
          </div>
        </div>

        {/* Dominio: reconocible de un vistazo en la conversación. */}
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            alignItems: "center",
            gap: 14,
            background: "rgba(53, 175, 109, 0.18)",
            border: "2px solid rgba(53, 175, 109, 0.45)",
            borderRadius: 999,
            padding: "14px 32px",
            fontSize: 28,
            fontWeight: 600,
            color: "#8FD4AC",
          }}
        >
          {new URL(siteConfig.url).hostname}
        </div>
      </div>
    ),
    size,
  );
}
