import {
  Bike,
  CalendarCheck,
  CalendarClock,
  Clock,
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

function TarjetaDomicilio({ entrega }: { entrega: EntregaConfig }) {
  const { costo, tiempo, pedidoMinimo } = entrega;

  const costoTexto = (() => {
    switch (costo.modo) {
      case "gratis":
        return COPY.gratis;
      case "consultar":
        return COPY.consultar;
      case "fijo":
        return fmtMonto(costo.monto, costo.moneda);
      case "gratis_desde":
        return `${COPY.gratis} desde ${fmtMonto(costo.desde, costo.moneda)}`;
      case "zonas":
        return costo.zonas.map((z) => `${z.nombre}: ${fmtMonto(z.monto, costo.moneda)}`).join(" · ");
    }
  })();

  return (
    <div className="flex flex-col gap-gap-xs">
      <p className={SECTION_TITLE}>Pedidos a domicilio</p>
      <Fila icon={Bike} label={COPY.envio} valor={costoTexto} />
      <Fila icon={Clock} label={COPY.tiempoEntrega} valor={fmtTiempo(tiempo)} />
      {pedidoMinimo && (
        <Fila
          icon={Package}
          label={COPY.pedidoMinimo}
          valor={fmtMonto(pedidoMinimo.monto, pedidoMinimo.moneda)}
        />
      )}
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
