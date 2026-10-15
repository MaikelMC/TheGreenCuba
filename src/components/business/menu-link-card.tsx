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

/** El rótulo que va bajo el QR en pantalla. */
const BRAND_TEXT = "Encuéntranos en La Verde";

/* La paleta del sticker, en hex y no en clases de Tailwind: esto se dibuja fuera
   de React y acaba impreso, así que no hay CSS que valga. Son `verde-400` y
   `verde-950` del sistema. */
const VERDE = "#35AF6D";
const VERDE_TINTA = "#052017";

/* El marco, medido en **módulos del QR** —la unidad que ya usa el código del
   propio QR—. Así crece solo con la versión del código y no hay ni un número
   elegido a ojo contra un tamaño de pantalla. */
const MARGEN = 4; // verde alrededor del panel blanco
const BANDA_ARRIBA = 9; // el nombre del negocio
const BANDA_ABAJO = 9; // la firma
const RADIO = 6; // esquinas del marco
const RADIO_PANEL = 3; // esquinas del panel blanco

/* La firma de abajo: el logotipo y el nombre, centrados. */
const ETIQUETA = "La Verde";
const ALTO_LOGO = 4.2; // alto del logotipo, en módulos
const RELACION_LOGO = 256 / 267; // la proporción de `public/logo.png`
const HUECO = 1.2; // entre el logotipo y el nombre
const CUERPO_FIRMA = 3.4; // el nombre de la firma

/* La display del design system, la misma de los titulares. El nombre de familia
   suelto no vale —`next/font` la registra con un hash—, así que dentro del SVG
   se declara otra vez con `@font-face` y este es el nombre que se le da. Las
   que van detrás son el relevo: si el archivo no llegó a incrustarse, el texto
   sigue saliendo. */
const FAMILIA = "LVDisplay";
const FUENTE = `${FAMILIA}, 'Space Grotesk', system-ui, sans-serif`;

/** El ancho del PNG, en píxeles. El alto sale de la proporción del sticker. */
const ANCHO_PNG = 1024;

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
 * Las medidas del sticker, en módulos del QR.
 *
 * Una sola vez para los dos formatos: el SVG escribe estos números como
 * atributos y el PNG los usa para calcular el lienzo. Con dos juegos de cuentas
 * el PNG y el SVG se separarían al primer retoque del marco.
 *
 * `x` e `y` son la esquina del panel blanco —el que **es** la zona de silencio
 * del QR—, y son lo único que cambia entre las dos versiones: con marco el panel
 * va metido dentro —banda arriba para el nombre, margen verde alrededor—, y sin
 * marco el panel es ya todo el sticker.
 */
function medidas(modulos: number, sinMarca: boolean) {
  const panel = modulos + QUIET * 2;
  const x = sinMarca ? MARGEN : 0;
  const y = sinMarca ? BANDA_ARRIBA : 0;
  /* La banda de abajo es la firma de La Verde, y sin marca ya no hay firma: sin
     esto al sticker de Menú Pro le sobraría un cinturón verde vacío. */
  const abajo = sinMarca ? 0 : BANDA_ABAJO;
  return {
    /** El panel blanco. **Es** la zona de silencio del QR, no un adorno. */
    panel,
    x,
    y,
    ancho: panel + x * 2,
    alto: y + panel + abajo,
  };
}

/**
 * El ancho de un texto, en em.
 *
 * ponytail: se **mide** con un lienzo en vez de estimarlo con un ancho medio por
 * letra. En el SVG el texto es una cadena y no hay nada que medir, y con dos
 * cuentas distintas —una a ojo para el SVG y otra real para el PNG— el archivo y
 * la pantalla saldrían descuadrados entre sí. El lienzo sí puede medir, y mide
 * con la misma familia que se incrusta, así que el número vale para los dos.
 *
 * A 100px de cuerpo para que el resultado salga ya en em y sirva para cualquier
 * tamaño. El lienzo se crea y se tira: no se guarda, mide un par de cadenas.
 */
function anchoEm(texto: string, peso: number): number {
  const ctx = document.createElement("canvas").getContext("2d");
  /* Sin lienzo no hay medida; la estimación por letra es el último recurso. */
  if (!ctx) return texto.length * 0.6;
  const display = getComputedStyle(document.body)
    .getPropertyValue("--font-lv-display")
    .trim();
  /* El nombre con hash de `next/font` es el único que el navegador conoce. */
  ctx.font = `${peso} 100px ${display || FUENTE}`;
  return ctx.measureText(texto).width / 100;
}

/**
 * El nombre del negocio, en mayúsculas y con el tamaño que le deja la banda.
 *
 * Los cuerpos bajan de golpe en vez de calcularse: son cinco y el que salga
 * tiene que verse entero, no al milímetro.
 */
function ajustarNombre(nombre: string, ancho: number) {
  const texto = nombre.toUpperCase();
  const em = anchoEm(texto, 700);
  for (const tamano of [4.2, 3.7, 3.2, 2.8, 2.4]) {
    if (em * tamano <= ancho) return { texto, tamano };
  }
  /* Ni con el cuerpo más pequeño cabe: se recorta y se dice que se recortó. */
  const tamano = 2.4;
  const caben = Math.max(3, Math.floor(ancho / (em * tamano)) - 1);
  return { texto: `${texto.slice(0, caben)}…`, tamano };
}

/** Lo mínimo para que un nombre con `&` o `<` no rompa el XML. */
function escapa(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Lo que se incrusta dentro del SVG y que no puede venir del propio SVG. */
interface Recursos {
  /** La display, en data URL. `null` si no se pudo traer. */
  fuente: string | null;
  /** El logotipo, en data URL. `null` si no se pudo traer. */
  logo: string | null;
}

/** Un archivo de `public/` en data URL. `null` en vez de excepción: el sticker
    sale igual, sin ese adorno, y quien descarga no tiene por qué enterarse. */
async function dataUrl(ruta: string): Promise<string | null> {
  try {
    const res = await fetch(ruta);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(String(lector.result));
      lector.onerror = () => reject(new Error(ruta));
      lector.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * La tipografía y el logotipo, listos para incrustar.
 *
 * Se piden **al pulsar Descargar**, no al montar la tarjeta: son ~50 KB que solo
 * paga quien de verdad se lleva el archivo. Metidos en el bundle los pagaría
 * todo el que abra el panel, aunque nunca descargue el QR.
 *
 * Es también lo que hace que el PNG salga con la tipografía buena: un `Image` no
 * carga las fuentes de la página, pero sí las que van dentro del propio SVG.
 */
async function traerRecursos(): Promise<Recursos> {
  /* `fonts.ready` antes de medir: si el nombre se midiera contra la fuente de
     reserva, el cuerpo que saliera no sería el que luego se pinta. */
  await document.fonts?.ready;
  const [fuente, logo] = await Promise.all([
    dataUrl("/fonts/space-grotesk.woff2"),
    dataUrl("/logo.png"),
  ]);
  return {
    /* El `data:` de un woff2 puede llegar con el tipo que ponga el servidor; se
       reescribe a `font/woff2` porque `@font-face` sí mira ese tipo. */
    fuente: fuente?.replace(/^data:[^;]+;/, "data:font/woff2;") ?? null,
    logo,
  };
}

/**
 * La firma: el logotipo y «La Verde», centrados.
 *
 * Va siempre sobre el panel blanco —es la versión con marca, la única que la
 * lleva—, así que el logotipo verde se lee suelto y no hace falta pastilla.
 *
 * El ancho se **mide** (ver `anchoEm`) y el conjunto se centra con esa cuenta:
 * centrar a ojo es justo lo que deja una firma descuadrada.
 */
function firmaDeMarca(ancho: number, alto: number, logo: string | null): string {
  const centroY = alto - BANDA_ABAJO / 2;
  const anchoLogo = logo ? ALTO_LOGO * RELACION_LOGO : 0;
  const hueco = logo ? HUECO : 0;
  const anchoTexto = anchoEm(ETIQUETA, 700) * CUERPO_FIRMA;
  const contenido = anchoLogo + hueco + anchoTexto;
  const inicio = (ancho - contenido) / 2;

  /* Sin logotipo queda solo el nombre, igual de centrado: el ancho que se le
     resta al conjunto es cero y la cuenta sale sola. */
  const logotipo = logo
    ? `<image x="${inicio}" y="${centroY - ALTO_LOGO / 2}" width="${anchoLogo}" ` +
      `height="${ALTO_LOGO}" preserveAspectRatio="xMidYMid meet" href="${logo}"/>`
    : "";

  return (
    logotipo +
    `<text x="${inicio + anchoLogo + hueco}" y="${centroY + CUERPO_FIRMA * 0.35}" ` +
    `text-anchor="start" fill="${VERDE_TINTA}" font-size="${CUERPO_FIRMA}" ` +
    `font-weight="700">${escapa(ETIQUETA)}</text>`
  );
}

/**
 * El sticker entero, en SVG. Dos versiones, y la diferencia es `sinMarca`:
 *
 * - **Sin marca** (Menú Pro): fondo verde redondeado con el nombre del negocio
 *   en una banda arriba, el QR sobre su panel blanco, y nada de La Verde.
 * - **Con marca** (Gratis): el panel blanco con el QR y la firma de La Verde
 *   debajo. El QR tal cual, sin adorno alrededor.
 *
 * Se envuelve el SVG del componente dentro de otro mayor en vez de retocarlo: el
 * original solo pinta los cuadros, así que el marco y los textos van fuera, en
 * unidades de módulo, y el conjunto escala limpio a cualquier tamaño.
 *
 * El QR entra **a su tamaño exacto** —`modulos` módulos— y no estirado hasta los
 * bordes del panel: el blanco que sobra es la zona de silencio, y sin ella el
 * lector no engancha el código.
 *
 * La tipografía no viaja con el archivo por su cuenta: el SVG es autónomo —lo
 * abre un programa de dibujo, o lo rasteriza un `Image` que no ve las fuentes de
 * la página—, así que va dentro, en un `@font-face` con el woff2 en data URL.
 * Es lo que hace que el PNG salga con la display del sistema y no con la sans
 * que el navegador tenga por defecto.
 *
 * La firma del pie es la marca de La Verde, y va **solo** en la versión con
 * marca: contratar Menú Pro es quitarla y poner el nombre del negocio en su
 * lugar.
 */
function stickerSvg(
  svg: SVGSVGElement,
  nombre: string,
  { fuente, logo }: Recursos,
  sinMarca: boolean,
): string {
  const modulos = qrModules(svg);
  const { panel, x, y, ancho, alto } = medidas(modulos, sinMarca);
  const { texto, tamano } = ajustarNombre(nombre, panel);

  const qr = svg.cloneNode(true) as SVGSVGElement;
  qr.removeAttribute("height");
  qr.removeAttribute("width");
  qr.setAttribute("x", String(x + QUIET));
  qr.setAttribute("y", String(y + QUIET));
  qr.setAttribute("width", String(modulos));
  qr.setAttribute("height", String(modulos));

  const estilo = fuente
    ? `<defs><style>@font-face{font-family:${FAMILIA};` +
      `src:url("${fuente}") format("woff2");font-weight:300 700;}</style></defs>`
    : "";

  /* La banda del nombre va con el marco y no sin él: el texto es blanco y sin el
     verde detrás no se vería. */
  const banda = sinMarca
    ? `<text x="${ancho / 2}" y="${BANDA_ARRIBA / 2 + tamano * 0.35}" ` +
      `text-anchor="middle" fill="#ffffff" font-size="${tamano}" ` +
      `font-weight="700">${escapa(texto)}</text>`
    : "";

  /* `y` es la línea base, y sale del centro de la banda a mano. Nada de
     `dominant-baseline`: los rasterizadores de SVG —el `Image` que hace el
     PNG— no lo tratan todos igual, y ahí el texto acaba descentrado. */
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" ` +
    `width="${ancho}" height="${alto}" font-family="${FUENTE}">` +
    estilo +
    `<rect width="${ancho}" height="${alto}" rx="${RADIO}" ` +
    `fill="${sinMarca ? VERDE : "#ffffff"}"/>` +
    `<rect x="${x}" y="${y}" width="${panel}" height="${panel}" ` +
    `rx="${RADIO_PANEL}" fill="#ffffff"/>` +
    new XMLSerializer().serializeToString(qr) +
    banda +
    (sinMarca ? "" : firmaDeMarca(ancho, alto, logo)) +
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
 * La marca de La Verde —el rótulo bajo el QR y la firma del pie, logotipo y
 * nombre— va mientras el negocio no contrate **Menú Pro**: eso es justo lo que
 * apaga `sinMarca`, en pantalla y en los dos archivos. Con el módulo, el QR pasa
 * a llevar el marco verde con el nombre del negocio en lugar de la marca.
 *
 * La tipografía y el logotipo se piden a `public/` al pulsar Descargar. El woff2
 * es una copia del de `src/fonts/`, la misma que declara `next/font`: aquí hace
 * falta una ruta estable, y `next/font` sirve el suyo con el nombre hasheado.
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
  /** `true` si el negocio tiene Menú Pro: quita la marca de La Verde del QR. */
  sinMarca?: boolean;
}) {
  const qrBoxRef = useRef<HTMLDivElement>(null);
  /* Ruta relativa derivada de la URL absoluta: la comparte `sharePlace`, que le
     añade la query de atribución. Así el enlace compartido es el mismo que el
     del QR y no uno construido a mano que se quede atrás. */
  const path = url.replace(/^https?:\/\/[^/]+/, "");

  const downloadSvg = useCallback(async () => {
    const svg = qrBoxRef.current?.querySelector("svg");
    if (!svg) return;
    try {
      const blob = new Blob(
        [stickerSvg(svg, placeName, await traerRecursos(), sinMarca)],
        { type: "image/svg+xml;charset=utf-8" },
      );
      downloadBlob(blob, `qr-${slugify(placeName) || placeId}.svg`);
    } catch {
      toast.error("No se pudo descargar el QR.");
    }
  }, [placeId, placeName, sinMarca]);

  const downloadPng = useCallback(async () => {
    const svg = qrBoxRef.current?.querySelector("svg");
    if (!svg) return;

    const { ancho, alto } = medidas(qrModules(svg), sinMarca);
    const escala = ANCHO_PNG / ancho;

    /* Se rasteriza **el sticker entero**, no el QR suelto con el marco dibujado
       a mano encima: así el PNG no puede separarse del SVG por un retoque que se
       haga en uno solo. */
    const svgUrl = URL.createObjectURL(
      new Blob([stickerSvg(svg, placeName, await traerRecursos(), sinMarca)], {
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
      canvas.width = Math.round(ancho * escala);
      canvas.height = Math.round(alto * escala);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Sin contexto 2D");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

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
  }, [placeId, placeName, sinMarca]);

  return (
    <section className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft lg:col-span-2">
      <h2 className="font-lv-display text-body font-semibold text-ink">
        Tu menú online
      </h2>
      <p className="mt-gap-xs max-w-[60ch] text-small text-ink-soft/75">
        Tu carta se abre{" "}
        <strong className="font-semibold text-ink">sin pedir cuenta</strong>.
        Compártela o imprime el QR.
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
            {/* La marca de La Verde dentro de la carta devuelve aquí a quien
                vino de aquí; sin el aviso lleva a la portada pública, que es lo
                que le toca a quien barre el QR. Va en el enlace y **no** en
                `path`: `path` es también lo que comparte el botón de al lado, y
                el enlace que se manda a un cliente no puede llevar la marca del
                panel del dueño. Ver `MarcaCarta`. */}
            <Link href={`${path}?volver=panel`} target="_blank" className={BTN}>
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
            {/* Con Menú Pro el QR es del negocio y el rótulo de La Verde
                desaparece; sin él, el rótulo es lo que dice de dónde sale. */}
            {!sinMarca && (
              <span className="font-lv-display text-[11px] font-semibold text-ink">
                {BRAND_TEXT}
              </span>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-gap-xs">
            <button
              type="button"
              onClick={() => void downloadPng()}
              className={BTN}
            >
              <Download size={15} strokeWidth={1.8} />
              PNG
            </button>
            <button
              type="button"
              onClick={() => void downloadSvg()}
              className={BTN}
            >
              <Download size={15} strokeWidth={1.8} />
              SVG
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
