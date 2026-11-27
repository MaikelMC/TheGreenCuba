import {
  CONTRATO_INTRO,
  CONTRATO_SECCIONES,
  CONTRATO_TITULO,
  type BloqueContrato,
} from "@/content/contrato-la-verde";
import {
  formatoCup,
  formatoUsd,
  type FacturaResumen,
  type PeriodoPago,
} from "@/lib/facturas";

/** Los datos que el cliente completa en el apartado legal de su factura. */
export interface DatosContrato {
  negocio: string;
  titular: string;
  servicios: string;
  fechaInicio: string;
  precio: string;
  periodicidad: string;
  promocion: string;
  canal: string;
  observaciones: string;
  diasAtencion: string;
  horarioAtencion: string;
  representante: string;
  firma: string;
  fechaFirma: string;
}

/** Los campos sin los que la descarga no se considera completa. */
export function contratoCompleto(datos: DatosContrato): boolean {
  return Boolean(
    datos.titular.trim() &&
      datos.representante.trim() &&
      datos.firma.trim(),
  );
}

const FECHA_LARGA = new Intl.DateTimeFormat("es-CU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Havana",
});

function fechaLegible(iso: string): string {
  const [anio, mes, dia] = iso.split("-").map(Number);
  if (!anio || !mes || !dia) return iso;
  return FECHA_LARGA.format(new Date(Date.UTC(anio, mes - 1, dia, 12)));
}

/** Los valores que ya conoce la factura; el resto lo escribe el cliente. */
export function datosContratoIniciales(
  factura: FacturaResumen,
  periodo: PeriodoPago,
): DatosContrato {
  return {
    negocio: factura.negocioNombre,
    titular: "",
    servicios: factura.conceptos.map((concepto) => concepto.nombre).join(" · "),
    fechaInicio: fechaLegible(periodo.inicio),
    precio: `${formatoUsd(factura.precioUsd)} USD`,
    periodicidad: `Mensual · próximo cobro ${fechaLegible(periodo.proximoCobro)}`,
    promocion: factura.oferta2x1
      ? "2×1 del primer pago (segundo mes sin costo)"
      : "Ninguna",
    canal: "",
    observaciones: "",
    diasAtencion: "",
    horarioAtencion: "",
    representante: "",
    firma: "",
    fechaFirma: fechaLegible(
      new Date().toLocaleDateString("en-CA", { timeZone: "America/Havana" }),
    ),
  };
}

function valor(valor: string): string {
  return valor.trim() || "________________________________";
}

export function resolverTokens(texto: string, datos: DatosContrato): string {
  return texto
    .replaceAll(
      "{{DIAS}}",
      datos.diasAtencion.trim() || "[Completar días de atención]",
    )
    .replaceAll(
      "{{HORARIO}}",
      datos.horarioAtencion.trim() ||
        "[Completar horario y zona horaria]",
    );
}

function escapar(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function bloquesHtml(bloques: BloqueContrato[], datos: DatosContrato): string {
  return bloques
    .map((bloque) => {
      const titulo = bloque.titulo
        ? `<h3>${escapar(resolverTokens(bloque.titulo, datos))}</h3>`
        : "";
      const parrafos = (bloque.parrafos ?? [])
        .map((p) => `<p>${escapar(resolverTokens(p, datos))}</p>`)
        .join("");
      const puntos =
        bloque.puntos && bloque.puntos.length > 0
          ? `<ul>${bloque.puntos
              .map((p) => `<li>${escapar(resolverTokens(p, datos))}</li>`)
              .join("")}</ul>`
          : "";
      const subsecciones =
        bloque.subsecciones && bloque.subsecciones.length > 0
          ? bloquesHtml(bloque.subsecciones, datos)
          : "";
      return `${titulo}${parrafos}${puntos}${subsecciones}`;
    })
    .join("");
}

/**
 * El contrato completo, listo para descargar e imprimir.
 *
 * Se escribe a mano, sin imágenes ni dependencias, para que se abra igual en
 * cualquier equipo y pueda guardarse como PDF desde el navegador. Los datos
 * del cliente van delante; las condiciones generales, después.
 */
export function htmlContrato(
  factura: FacturaResumen,
  datos: DatosContrato,
  cup: number | null,
): string {
  const numero =
    factura.numeroFactura !== null
      ? `Factura n.º ${String(factura.numeroFactura).padStart(4, "0")}`
      : "Factura";
  const conceptos = factura.conceptos
    .map((concepto) => `<li>${escapar(concepto.nombre)}</li>`)
    .join("");
  const observaciones = datos.observaciones.trim()
    ? `<p class="observaciones">${escapar(datos.observaciones)}</p>`
    : `<p class="observaciones vacio">________________________________</p>`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Contrato ${escapar(factura.id)} — La Verde</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #08130D; color: #EDF7F0; font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  main { max-width: 820px; margin: 28px auto; background: #0E1720; border: 1px solid rgba(237,247,240,.12); border-radius: 24px; padding: 36px; }
  header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid rgba(237,247,240,.1); padding-bottom: 22px; }
  .marca { font-size: 24px; font-weight: 800; letter-spacing: -0.03em; }
  .verde { color: #9BE3B4; }
  .meta { text-align: right; color: rgba(237,247,240,.78); font-size: 12px; }
  .meta .id { font-family: ui-monospace, monospace; color: #EDF7F0; }
  h1 { font-size: 25px; margin: 28px 0 6px; letter-spacing: -0.02em; }
  .lema { color: rgba(237,247,240,.72); margin: 0 0 26px; }
  h2 { font-size: 18px; margin: 30px 0 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(237,247,240,.1); }
  h3 { font-size: 15px; margin: 22px 0 6px; color: #9BE3B4; }
  p { margin: 8px 0; color: rgba(237,247,240,.86); }
  ul { margin: 8px 0 14px; padding-left: 22px; color: rgba(237,247,240,.86); }
  li { margin: 5px 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 8px; }
  th, td { text-align: left; vertical-align: top; padding: 9px 0; border-bottom: 1px solid rgba(237,247,240,.1); }
  th { width: 34%; color: rgba(237,247,240,.65); font-weight: 500; }
  .observaciones { background: #16212B; border-radius: 12px; padding: 12px 14px; color: rgba(237,247,240,.86); white-space: pre-wrap; }
  .vacio { color: rgba(237,247,240,.55); }
  .firma { margin-top: 22px; display: grid; gap: 8px; }
  .firma div { padding: 12px 0; border-bottom: 1px solid rgba(237,247,240,.25); color: rgba(237,247,240,.9); }
  .firma span { color: rgba(237,247,240,.6); font-size: 12px; }
  .factura { background: #16212B; border-radius: 14px; padding: 16px 18px; margin-top: 12px; }
  .factura .total { display: flex; justify-content: space-between; align-items: baseline; border-top: 1px solid rgba(237,247,240,.1); margin-top: 12px; padding-top: 12px; }
  .factura strong { font-size: 20px; }
  footer { margin-top: 32px; font-size: 12px; color: rgba(237,247,240,.55); }
  .acciones { position: fixed; right: 18px; bottom: 18px; }
  .acciones button { border: 0; border-radius: 999px; background: #35AF6D; color: #052017; font: inherit; font-weight: 700; padding: 12px 20px; cursor: pointer; }
  @media print {
    body { background: #fff; color: #14231a; }
    main { margin: 0; border: 0; background: #fff; padding: 0; max-width: none; }
    h3, .verde { color: #1d6b3f; }
    p, ul, .meta, footer { color: #35473c; }
    th { color: #55685b; }
    .observaciones, .factura { background: #f4f1e9; }
    .acciones { display: none; }
  }
</style>
</head>
<body>
<main>
  <header>
    <div>
      <div class="marca">La Verde <span class="verde">·</span> Contrato</div>
      <div>Servicios para negocios en Cuba</div>
    </div>
    <div class="meta">
      <div class="id">${escapar(factura.id)}</div>
      <div>${escapar(numero)}</div>
      <div>${escapar(factura.negocioNombre)}</div>
    </div>
  </header>

  <h1>${escapar(CONTRATO_TITULO)}</h1>
  <p class="lema">Documento legal de la contratación de servicios de La Verde.</p>

  <h2>Información particular de tu contratación</h2>
  <table>
    <tr><th>Nombre del negocio</th><td>${escapar(valor(datos.negocio))}</td></tr>
    <tr><th>Titular o representante</th><td>${escapar(valor(datos.titular))}</td></tr>
    <tr><th>Servicios contratados</th><td>${escapar(valor(datos.servicios))}</td></tr>
    <tr><th>Fecha de inicio</th><td>${escapar(valor(datos.fechaInicio))}</td></tr>
    <tr><th>Precio y moneda</th><td>${escapar(valor(datos.precio))}${
      cup !== null ? ` · ≈ ${escapar(formatoCup(cup))} CUP` : ""
    }</td></tr>
    <tr><th>Periodicidad de pago</th><td>${escapar(valor(datos.periodicidad))}</td></tr>
    <tr><th>Promoción aplicada</th><td>${escapar(valor(datos.promocion))}</td></tr>
    <tr><th>Canal de contacto asignado</th><td>${escapar(valor(datos.canal))}</td></tr>
  </table>
  <h3>Observaciones y condiciones particulares</h3>
  ${observaciones}

  <h2>Confirmación de recepción y aceptación</h2>
  <p>Con mi firma o aceptación correspondiente, confirmo que he recibido este documento y conozco las condiciones generales de prestación, soporte, seguimiento, cancelación y reembolso de los servicios de La Verde.</p>
  <div class="firma">
    <div>${escapar(valor(datos.representante))}<br><span>Nombre del representante</span></div>
    <div>${escapar(valor(datos.firma))}<br><span>Firma</span></div>
    <div>${escapar(valor(datos.fechaFirma))}<br><span>Fecha</span></div>
  </div>

  <h2>Servicios y factura</h2>
  <div class="factura">
    <p><strong>${escapar(numero)}</strong> · Referencia ${escapar(factura.id)}</p>
    <ul>${conceptos}</ul>
    <div class="total">
      <span>Total</span>
      <strong>${escapar(formatoUsd(factura.precioUsd))} USD${
        cup !== null ? ` <small>≈ ${escapar(formatoCup(cup))} CUP</small>` : ""
      }</strong>
    </div>
  </div>

  <h2>Condiciones generales</h2>
  ${CONTRATO_INTRO.map((p) => `<p>${escapar(p)}</p>`).join("")}
  ${bloquesHtml(CONTRATO_SECCIONES, datos)}

  <footer>
    LA VERDE · Tecnología que conecta, organiza e impulsa negocios.<br>
    Sitio web: https://laverde.kynari.dev · Instagram: @laverdecuba<br>
    Documento generado desde la factura ${escapar(factura.id)}.
  </footer>
</main>
<div class="acciones no-print">
  <button type="button" onclick="window.print()">Imprimir / Guardar PDF</button>
</div>
</body>
</html>`;
}

/** Descarga un HTML autocontenido, como la copia de la factura. */
export function descargarHtml(nombre: string, contenido: string): void {
  const blob = new Blob([contenido], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
