"use client";

import { useCallback, useRef } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import { ArrowUpRight, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { sharePlace } from "@/lib/share";
import { slugify } from "@/lib/utils";
import { CopyLink } from "@/components/profile/copy-link";

/** El negro del sistema, y no el `#000` por defecto: el QR va impreso y sale
    del mismo sitio que el resto de la marca. */
const INK = "#08130D";

/** Zona de silencio del QR, en módulos. Cuatro por lado, como manda el estándar. */
const QUIET = 4;

/** El texto que va bajo el QR cuando el plan no quita la marca. */
const BRAND_TEXT = "Encuéntranos en La Verde";

/** Botón de la casa: los mismos 44 px y el mismo borde que el resto del panel. */
const BTN =
  "inline-flex h-11 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-md " +
  "font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint " +
  "hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600";

/** Dispara la descarga de un blob sin salir de la página. */
function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  /* El `revoke` va con retardo y no en la línea siguiente: la descarga no
     empieza en el mismo turno en todos los navegadores, y liberar la URL en
     el acto la cancela sin dejar rastro en la consola. */
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/** Cuántos módulos tiene el QR que ha pintado `react-qr-code`. */
function qrModules(svg: SVGSVGElement): number {
  return svg.viewBox.baseVal.width || 33;
}

/**
 * El SVG final, con su zona de silencio y —si toca— la marca.
 *
 * Se envuelve el SVG del componente en otro mayor en vez de retocarlo: el
 * original solo pinta los cuadros, así que el margen blanco y el texto van
 * fuera, en unidades de módulo, y así el resultado escala limpio a cualquier
 * tamaño.
 */
function buildSvgString(svg: SVGSVGElement, branded: boolean): string {
  const modules = qrModules(svg);
  const total = modules + QUIET * 2;
  const captionH = branded ? 7 : 0;
  const height = total + captionH;

  const inner = svg.cloneNode(true) as SVGSVGElement;
  inner.removeAttribute("height");
  inner.removeAttribute("width");
  inner.setAttribute("x", String(QUIET));
  inner.setAttribute("y", String(QUIET));
  inner.setAttribute("width", String(modules));
  inner.setAttribute("height", String(modules));

  const caption = branded
    ? `<text x="${total / 2}" y="${total + 5}" text-anchor="middle" ` +
      `font-family="DM Sans, system-ui, sans-serif" font-size="3.2" ` +
      `font-weight="600" fill="${INK}">${BRAND_TEXT}</text>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${height}" ` +
    `width="${total}" height="${height}">` +
    `<rect width="100%" height="100%" fill="#ffffff"/>` +
    new XMLSerializer().serializeToString(inner) +
    caption +
    `</svg>`
  );
}

/**
 * El enlace del menú, con lo que hace falta para repartirlo.
 *
 * Va en el panel del negocio y no en la ficha pública porque es una herramienta
 * del dueño: hasta ahora tenía que buscarse en el mapa y pulsar «Compartir» en
 * su propio negocio para conseguir la URL de su carta.
 *
 * El QR se descarga en **PNG y SVG**. El PNG es para quien va a una copistería
 * con una imagen; el SVG para quien va a imprimir en grande o retocar el
 * archivo, que es donde un vectorial manda.
 *
 * `sinMarca` lo decide el plan en el servidor (`menu_qr_sin_marca`, Básico+).
 * En Gratis el QR lleva debajo «Encuéntranos en La Verde», tanto en pantalla
 * como en los dos archivos; en Básico y Pro sale limpio.
 */
export function MenuLinkCard({
  placeId,
  placeName,
  url,
  sinMarca = false,
}: {
  placeId: string;
  placeName: string;
  /** La URL absoluta de la carta, resuelta en el servidor. */
  url: string;
  /** `true` si el plan quita la marca del QR (`menu_qr_sin_marca`). */
  sinMarca?: boolean;
}) {
  const qrBoxRef = useRef<HTMLDivElement>(null);
  const branded = !sinMarca;
  /* Ruta relativa derivada de la URL absoluta: la comparte `sharePlace`, que le
     añade la query de atribución. Así el enlace compartido es el mismo que el
     del QR y no uno construido a mano que se quede atrás. */
  const path = url.replace(/^https?:\/\/[^/]+/, "");

  const downloadSvg = useCallback(() => {
    const svg = qrBoxRef.current?.querySelector("svg");
    if (!svg) return;
    try {
      const blob = new Blob([buildSvgString(svg, branded)], {
        type: "image/svg+xml;charset=utf-8",
      });
      downloadBlob(blob, `qr-${slugify(placeName) || placeId}.svg`);
    } catch {
      toast.error("No se pudo descargar el QR.");
    }
  }, [branded, placeId, placeName]);

  const downloadPng = useCallback(async () => {
    const svg = qrBoxRef.current?.querySelector("svg");
    if (!svg) return;

    const size = 1024;
    const modules = qrModules(svg);
    const unit = size / (modules + QUIET * 2);
    const inner = unit * modules;
    const captionH = branded ? Math.round(size * 0.1) : 0;

    const svgUrl = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(svg)], {
        type: "image/svg+xml;charset=utf-8",
      }),
    );

    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("No se pudo dibujar el QR"));
        image.src = svgUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size + captionH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Sin contexto 2D");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, unit * QUIET, unit * QUIET, inner, inner);

      if (branded) {
        ctx.fillStyle = INK;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `600 ${Math.round(size * 0.045)}px "DM Sans", system-ui, sans-serif`;
        ctx.fillText(BRAND_TEXT, size / 2, size + captionH / 2);
      }

      const png = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!png) throw new Error("Sin PNG");
      downloadBlob(png, `qr-${slugify(placeName) || placeId}.png`);
    } catch {
      toast.error("No se pudo descargar el QR.");
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }, [branded, placeId, placeName]);

  return (
    <section className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft lg:col-span-2">
      <h2 className="font-lv-display text-body font-semibold text-ink">
        Tu menú online
      </h2>
      <p className="mt-gap-xs max-w-[60ch] text-small text-ink-soft/75">
        Este enlace abre tu carta y{" "}
        <strong className="font-semibold text-ink">no pide cuenta</strong> a
        quien lo recibe. Compártelo por WhatsApp o imprime el QR y ponlo en la
        mesa: quien lo escanee llega a la misma carta.
      </p>

      <div className="mt-gap-md grid gap-gap-md sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="flex flex-col gap-gap-sm">
          <CopyLink url={url} />
          <div className="flex flex-wrap gap-gap-xs">
            <button
              type="button"
              onClick={() =>
                void sharePlace(placeId, placeName, {
                  path,
                  campaign: "menu_share",
                  text: `Mira la carta de ${placeName}`,
                })
              }
              className={BTN}
            >
              <Share2 size={15} strokeWidth={1.8} />
              Compartir
            </button>
            <Link href={path} target="_blank" className={BTN}>
              <ArrowUpRight size={15} strokeWidth={1.8} />
              Ver mi carta
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-center gap-gap-sm">
          {/* El blanco alrededor no es adorno: es la zona de silencio del QR, y
              en la pantalla hace el mismo papel que en el papel. */}
          <div
            ref={qrBoxRef}
            className="flex flex-col items-center gap-gap-xs rounded-2xl border border-ink/5 bg-white p-gap-sm"
          >
            {/* Nivel M y no el L por defecto: esto se imprime, se pega en una
                mesa y se mancha. M tolera ~15% de daño sin dejar de leerse. */}
            <QRCode value={url} size={148} level="M" fgColor={INK} />
            {branded && (
              <span className="font-lv-display text-[11px] font-semibold text-ink">
                {BRAND_TEXT}
              </span>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-gap-xs">
            <button type="button" onClick={() => void downloadPng()} className={BTN}>
              <Download size={15} strokeWidth={1.8} />
              PNG
            </button>
            <button type="button" onClick={downloadSvg} className={BTN}>
              <Download size={15} strokeWidth={1.8} />
              SVG
            </button>
          </div>
          {branded && (
            <p className="max-w-[22ch] text-center text-meta text-ink-soft/75">
              Tu plan añade la marca de La Verde bajo el QR.{" "}
              <span className="font-semibold text-ink">
                Se quita con Básico.
              </span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
