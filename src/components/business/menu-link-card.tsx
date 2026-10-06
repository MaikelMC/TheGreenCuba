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

/** Botón de la casa: los mismos 44 px y el mismo borde que el resto del panel. */
const BTN =
  "inline-flex h-11 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-md " +
  "font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint " +
  "hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600";

/**
 * El enlace del menú, con lo que hace falta para repartirlo.
 *
 * Va en el panel del negocio y no en la ficha pública porque es una herramienta
 * del dueño: hasta ahora tenía que buscarse en el mapa y pulsar «Compartir» en
 * su propio negocio para conseguir la URL de su carta.
 *
 * El QR se descarga en PNG y no en SVG a propósito: quien lo lleva a imprimir
 * va a una copistería con una imagen, no con un vectorial.
 */
export function MenuLinkCard({
  placeId,
  placeName,
  url,
}: {
  placeId: string;
  placeName: string;
  /** La URL absoluta de la carta, resuelta en el servidor. */
  url: string;
}) {
  const qrBoxRef = useRef<HTMLDivElement>(null);

  const downloadQr = useCallback(async () => {
    const svg = qrBoxRef.current?.querySelector("svg");
    if (!svg) return;

    const size = 1024;
    /* Cuántos módulos tiene el QR, para poder escalarlo a un número entero de
       píxeles por módulo: si cada cuadro cae a medias de un píxel, el borde sale
       gris y un lector barato lo paga. */
    const modules = svg.viewBox.baseVal.width || 33;
    /* Zona de silencio: cuatro módulos por lado. El SVG del componente no la
       trae —solo pinta los cuadros—, y un QR pegado al borde de la imagen no se
       lee. */
    const unit = size / (modules + 8);
    const inner = unit * modules;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(inner));
    clone.setAttribute("height", String(inner));

    const svgUrl = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(clone)], {
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
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Sin contexto 2D");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(image, unit * 4, unit * 4, inner, inner);

      const png = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!png) throw new Error("Sin PNG");

      const link = document.createElement("a");
      link.href = URL.createObjectURL(png);
      link.download = `qr-${slugify(placeName) || placeId}.png`;
      link.click();
      /* El `revoke` va con retardo y no en la línea siguiente: la descarga no
         empieza en el mismo turno en todos los navegadores, y liberar la URL en
         el acto la cancela sin dejar rastro en la consola. */
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch {
      toast.error("No se pudo descargar el QR.");
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }, [placeId, placeName]);

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
                  path: `/place/${placeId}/carta`,
                  campaign: "menu_share",
                  text: `Mira la carta de ${placeName}`,
                })
              }
              className={BTN}
            >
              <Share2 size={15} strokeWidth={1.8} />
              Compartir
            </button>
            <Link href={`/place/${placeId}/carta`} target="_blank" className={BTN}>
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
            className="rounded-2xl border border-ink/5 bg-white p-gap-sm"
          >
            {/* Nivel M y no el L por defecto: esto se imprime, se pega en una
                mesa y se mancha. M tolera ~15% de daño sin dejar de leerse. */}
            <QRCode value={url} size={148} level="M" fgColor={INK} />
          </div>
          <button type="button" onClick={() => void downloadQr()} className={BTN}>
            <Download size={15} strokeWidth={1.8} />
            Descargar QR
          </button>
        </div>
      </div>
    </section>
  );
}
