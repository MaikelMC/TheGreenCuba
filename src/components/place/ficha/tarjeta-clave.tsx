import {
  Bike,
  CalendarCheck,
  CalendarClock,
  Clock,
  MapPin,
  MessageCircle,
  Package,
  Store,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComoAtiende, ComoComprar, EspecialDelDia, ModuloFicha } from "@/lib/ficha/tipos";
import type { EntregaConfig } from "@/lib/ficha/entrega";
import { COPY } from "@/config/ficha";

/** Hoy en zona de Cuba, formato `YYYY-MM-DD`. Para comparar con `hasta`. */
function hoyHavana(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Havana" }).format(
    new Date(),
  );
}

function fmtMonto(monto: number, moneda: string): string {
  return `${monto} ${moneda}`;
}

function fmtTiempo({ min, max }: { min: number; max: number }): string {
  return min === max ? `${min} min` : `${min}–${max} min`;
}

const SECTION_TITLE =
  "mb-gap-sm font-lv-display text-meta font-semibold uppercase tracking-[0.08em] text-ink-soft/60";

const ROW = "flex items-center gap-gap-sm";
const ICON_CHIP =
  "grid size-8 shrink-0 place-items-center rounded-full bg-sand-deep text-ink-soft/75";

function Fila({
  icon: Icono,
  label,
  valor,
  className,
}: {
  icon: React.ElementType;
  label: string;
  valor: string;
  className?: string;
}) {
  return (
    <div className={cn(ROW, className)}>
      <span className={ICON_CHIP}>
        <Icono size={16} strokeWidth={1.8} />
      </span>
      <span className="text-small text-ink">
        <span className="font-lv-display font-semibold text-ink-soft/70">
          {label}:{" "}
        </span>
        {valor}
      </span>
    </div>
  );
}

function BadgeCosto({ costo }: { costo: import("@/lib/ficha/entrega").CostoEntrega }) {
  if (costo.modo === "gratis") {
    return (
      <span className="domicilio-badge-gratis inline-flex items-center rounded-full border border-verde-200 bg-verde-50 px-[10px] py-[3px] font-lv-display text-[11px] font-semibold uppercase tracking-[0.1em] text-verde-700">
        Gratis
      </span>
    );
  }
  if (costo.modo === "gratis_desde") {
    return (
      <span className="text-small text-ink">
        <span className="font-semibold text-verde-600">Gratis</span>
        {" desde "}
        <span className="font-semibold">{fmtMonto(costo.desde, costo.moneda)}</span>
        {" · "}
        {fmtMonto(costo.monto, costo.moneda)} si no llega
      </span>
    );
  }
  if (costo.modo === "fijo") {
    return <span className="text-small font-semibold text-ink">{fmtMonto(costo.monto, costo.moneda)}</span>;
  }
  if (costo.modo === "consultar") {
    return <span className="text-small text-ink-soft/70">A consultar por WhatsApp</span>;
  }
  /* zonas: nunca llega aquí — se renderiza aparte */
  return null;
}

function TarjetaDomicilio({ entrega }: { entrega: EntregaConfig }) {
  const { costo, tiempo, pedidoMinimo, recogida, notaEntrega } = entrega;
  const esZonas = costo.modo === "zonas";
  const zonasActivas = esZonas ? costo.zonas.filter((z) => z.activa) : [];

  return (
    <div className="tarjeta-domicilio overflow-hidden rounded-2xl border border-verde-100 bg-gradient-to-br from-verde-50/50 to-white">
      {/* Cabecera */}
      <div className="tarjeta-domicilio-header flex items-center gap-gap-sm border-b border-verde-100 px-gap-md py-[12px]">
        <span className="domicilio-icon-circle grid size-9 shrink-0 place-items-center rounded-full bg-verde-100 text-verde-700">
          <Bike size={16} strokeWidth={1.8} />
        </span>
        <span className="font-lv-display text-small font-bold text-ink">
          Pedidos a domicilio
        </span>
        {recogida && (
          <span className="domicilio-recogida-badge ml-auto inline-flex items-center gap-[4px] rounded-full border border-ink/10 bg-white px-[8px] py-[3px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-soft/60">
            <Store size={10} strokeWidth={2} />
            Y recogida
          </span>
        )}
      </div>

      {/* Contenido */}
      <div className="flex flex-col gap-[10px] p-gap-md">
        {/* Costo de envío */}
        {esZonas ? (
          <div>
            <p className="mb-[6px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-soft/50">
              Zonas de entrega
            </p>
            <div className="flex flex-wrap gap-[6px]">
              {zonasActivas.length > 0 ? (
                zonasActivas.map((z) => (
                  <span
                    key={z.id}
                    className="domicilio-zona-pill inline-flex items-center gap-[5px] rounded-full border border-verde-100 bg-white px-[10px] py-[5px] font-lv-display text-[12px] text-ink"
                  >
                    <MapPin size={10} strokeWidth={2} className="shrink-0 text-verde-500" />
                    <span className="font-medium text-ink">{z.nombre}</span>
                    <span className="text-ink-soft/50">·</span>
                    <span className={cn("font-semibold", z.monto === 0 ? "text-verde-600" : "text-ink")}>
                      {z.monto === 0 ? "Gratis" : fmtMonto(z.monto, z.moneda)}
                    </span>
                  </span>
                ))
              ) : (
                <span className="text-small text-ink-soft/60">A consultar</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-gap-sm">
            <span className="font-lv-display text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft/50">
              {COPY.envio}
            </span>
            <BadgeCosto costo={costo} />
          </div>
        )}

        {/* Tiempo y mínimo */}
        <div className="flex flex-wrap gap-gap-sm">
          <span className="domicilio-chip inline-flex items-center gap-[5px] rounded-xl border border-ink/5 bg-white px-[10px] py-[6px] font-lv-display text-[12px] text-ink">
            <Clock size={12} strokeWidth={2} className="shrink-0 text-ink-soft/50" />
            <span className="font-medium">{fmtTiempo(tiempo)}</span>
          </span>
          {pedidoMinimo && (
            <span className="domicilio-chip inline-flex items-center gap-[5px] rounded-xl border border-ink/5 bg-white px-[10px] py-[6px] font-lv-display text-[12px] text-ink">
              <Package size={12} strokeWidth={2} className="shrink-0 text-ink-soft/50" />
              <span className="text-ink-soft/60">Mín.</span>
              <span className="font-semibold">{fmtMonto(pedidoMinimo.monto, pedidoMinimo.moneda)}</span>
            </span>
          )}
        </div>

        {/* Nota */}
        {notaEntrega && (
          <p className="domicilio-nota border-t border-verde-100 pt-[8px] text-[12px] italic leading-snug text-ink-soft/60">
            {notaEntrega}
          </p>
        )}
      </div>
    </div>
  );
}

function TarjetaLocal({ especialDia }: { especialDia: EspecialDelDia }) {
  return (
    <div className="rounded-2xl border border-verde-100 bg-verde-50/50 p-gap-md">
      <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.08em] text-verde-700">
        {COPY.especialDelDia}
      </p>
      <p className="mt-[4px] font-lv-display text-h3 font-bold text-ink">
        {especialDia.titulo}
      </p>
      {especialDia.descripcion && (
        <p className="mt-[2px] text-small leading-snug text-ink-soft/80">
          {especialDia.descripcion}
        </p>
      )}
      <div className="mt-gap-xs flex items-center gap-gap-sm">
        {especialDia.precio && (
          <span className="font-lv-display text-body font-bold text-ink">
            {especialDia.precio}
          </span>
        )}
        <span className="ml-auto font-lv-display text-meta text-ink-soft/60">
          {COPY.hastaEl} {especialDia.hasta}
        </span>
      </div>
    </div>
  );
}

function FilaTienda({
  icon: Icono,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className={ROW}>
      <span className={ICON_CHIP}>
        <Icono size={16} strokeWidth={1.8} />
      </span>
      <span className="text-small text-ink">{label}</span>
    </div>
  );
}

function TarjetaTienda({ comoComprar }: { comoComprar: ComoComprar }) {
  const hay = comoComprar.recoger || comoComprar.apartar;
  if (!hay) return null;

  return (
    <div className="flex flex-col gap-gap-xs">
      <p className={SECTION_TITLE}>{COPY.comoComprar}</p>
      {comoComprar.recoger && <FilaTienda icon={Store} label={COPY.recoger} />}
      {comoComprar.apartar && (
        <FilaTienda icon={MessageCircle} label={COPY.apartarWhatsapp} />
      )}
    </div>
  );
}

function FilaAtiende({
  icon: Icono,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className={ROW}>
      <span className={ICON_CHIP}>
        <Icono size={16} strokeWidth={1.8} />
      </span>
      <span className="text-small text-ink">{label}</span>
    </div>
  );
}

function TarjetaServicios({ comoAtiende }: { comoAtiende: ComoAtiende }) {
  const hay = comoAtiende.conCita || comoAtiende.sinCita || comoAtiende.aDomicilio;
  if (!hay) return null;

  return (
    <div className="flex flex-col gap-gap-xs">
      <p className={SECTION_TITLE}>{COPY.comoAtiende}</p>
      {comoAtiende.conCita && (
        <FilaAtiende icon={CalendarCheck} label={COPY.conCita} />
      )}
      {comoAtiende.sinCita && (
        <FilaAtiende icon={CalendarClock} label={COPY.sinCita} />
      )}
      {comoAtiende.aDomicilio && (
        <FilaAtiende icon={Truck} label={COPY.aDomicilio} />
      )}
    </div>
  );
}

/**
 * La tarjeta con la información clave del módulo activo.
 *
 * Solo se pinta si al menos uno de los módulos tiene datos que mostrar. Si
 * `modulosActivos` está vacío o los datos de todos los módulos son `null`, no
 * se renderiza nada —la ficha no inventa secciones que el dueño no configuró—.
 */
export function TarjetaClave({
  modulosActivos,
  entrega,
  comoComprar,
  comoAtiende,
  especialDia,
  className,
}: {
  modulosActivos: ModuloFicha[];
  entrega: EntregaConfig | null;
  comoComprar: ComoComprar | null;
  comoAtiende: ComoAtiende | null;
  especialDia: EspecialDelDia | null;
  className?: string;
}) {
  const hoy = hoyHavana();

  const especial =
    modulosActivos.includes("local") &&
    especialDia &&
    especialDia.hasta >= hoy
      ? especialDia
      : null;

  const seccionDomicilio =
    modulosActivos.includes("domicilio") && entrega ? (
      <TarjetaDomicilio entrega={entrega} />
    ) : null;

  const seccionLocal = especial ? <TarjetaLocal especialDia={especial} /> : null;

  const seccionTienda =
    modulosActivos.includes("tienda") && comoComprar ? (
      <TarjetaTienda comoComprar={comoComprar} />
    ) : null;

  const seccionServicios =
    modulosActivos.includes("servicios") && comoAtiende ? (
      <TarjetaServicios comoAtiende={comoAtiende} />
    ) : null;

  const secciones = [seccionDomicilio, seccionLocal, seccionTienda, seccionServicios].filter(
    Boolean,
  );

  if (secciones.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-ink/5 bg-white shadow-soft p-gap-md flex flex-col gap-gap-md",
        className,
      )}
    >
      {secciones.map((seccion, i) => (
        <div key={i}>
          {i > 0 && <div className="mb-gap-md border-t border-ink/5" />}
          {seccion}
        </div>
      ))}
    </div>
  );
}
