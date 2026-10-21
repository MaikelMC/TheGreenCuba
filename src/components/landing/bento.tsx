import {
  CalendarDays,
  Check,
  MapPin,
  QrCode,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

function MapVisual() {
  return (
    <div className="lv-mini-map relative h-28 overflow-hidden rounded-2xl border border-ink/10">
      <span className="absolute left-1/2 top-1/2 grid size-9 -translate-x-1/2 -translate-y-full place-items-center rounded-full bg-verde-500 text-white shadow-primary-halo">
        <MapPin size={17} strokeWidth={2.2} aria-hidden />
      </span>
      <span className="absolute left-[18%] top-[30%] size-5 rounded-full border-2 border-white bg-verde-300 shadow-soft" />
      <span className="absolute right-[22%] top-[62%] size-4 rounded-full border-2 border-white bg-verde-200 shadow-soft" />
    </div>
  );
}

function SearchVisual() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 rounded-full border border-ink/10 bg-white px-3 py-2 shadow-lv-xs">
        <Search size={14} className="shrink-0 text-ink-soft/65" aria-hidden />
        <span className="truncate text-xs text-ink-soft/75">¿dónde comer tacos?</span>
        <Sparkles size={13} className="ml-auto shrink-0 text-verde-500" aria-hidden />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["La Habana", "abierto ahora", "USD"].map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-ink/10 bg-sand px-2.5 py-1 text-[11px] font-medium text-ink-soft/70"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function QrVisual() {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-sand p-4">
      <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-white text-ink shadow-lv-xs">
        <QrCode size={40} strokeWidth={1.5} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ink">Carta digital</p>
        <p className="lv-mono mt-1 truncate text-[10px] uppercase tracking-[0.12em] text-ink-soft/65">
          Sin descargas
        </p>
      </div>
    </div>
  );
}

function OrdersVisual() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-sand px-3 py-2.5">
        <span className="text-xs font-medium text-ink">2 × Café con leche</span>
        <span className="lv-mono text-[10px] font-semibold text-verde-700">$4.00</span>
      </div>
      <div className="flex items-center justify-between rounded-full border border-ink/10 bg-white px-3 py-2">
        <span className="text-[11px] text-ink-soft/70">Reserva · 8:30 pm</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[10px] font-semibold text-white">
          <Check size={10} aria-hidden /> Listo
        </span>
      </div>
    </div>
  );
}

function EventVisual() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-sand p-3">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-ink text-center text-white">
        <span className="lv-mono text-[9px] uppercase tracking-[0.12em] opacity-70">Oct</span>
        <span className="-mt-1 text-sm font-bold leading-none">24</span>
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-ink">Noche de son</p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-soft/65">
          <CalendarDays size={11} aria-hidden /> Evento publicado
        </p>
      </div>
    </div>
  );
}

function TelegramVisual() {
  return (
    <div className="space-y-2 rounded-2xl border border-ink/10 bg-sand p-3">
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-3 py-2 text-[11px] leading-snug text-white">
        Añade dos cafés al menú
      </div>
      <div className="flex w-fit max-w-[85%] items-center gap-2 rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-[11px] leading-snug text-ink shadow-lv-xs">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-verde-100 text-verde-700">
          <Check size={11} aria-hidden />
        </span>
        Listo, ya están en tu carta.
      </div>
      <div className="flex items-center gap-2 rounded-full border border-ink/10 bg-white px-3 py-1.5">
        <span className="truncate text-[11px] text-ink-soft/65">Escríbele a tu asistente…</span>
        <Send size={12} className="ml-auto shrink-0 text-verde-600" aria-hidden />
      </div>
    </div>
  );
}

interface BentoCardProps {
  index: number;
  title: string;
  body: string;
  visual: React.ReactNode;
  className?: string;
  id?: string;
  wide?: boolean;
}

function BentoCard({
  index,
  title,
  body,
  visual,
  className,
  id,
  wide,
}: BentoCardProps) {
  return (
    <article
      id={id}
      className={cn(
        "group flex scroll-mt-28 flex-col overflow-hidden rounded-3xl border border-ink/10 bg-white p-6 shadow-soft transition duration-300 ease-outquint hover:-translate-y-0.5 hover:shadow-card sm:p-7",
        wide && "lg:flex-row lg:items-center lg:gap-8",
        className,
      )}
    >
      <div className={cn(wide && "lg:flex-1")}>
        <p className="lv-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft/65">
          {String(index).padStart(2, "0")} / 06
        </p>
        <h3 className="mt-3 font-lv-display text-xl font-bold tracking-[-0.025em] text-ink sm:text-2xl">
          {title}
        </h3>
        <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-ink-soft/75 text-pretty">
          {body}
        </p>
      </div>
      <div className={cn("mt-6", wide && "lg:mt-0 lg:w-[44%] lg:shrink-0")}>
        {visual}
      </div>
    </article>
  );
}

export function Bento() {
  return (
    <section
      id="como-funciona"
      className="relative scroll-mt-24 py-20 sm:py-28"
    >
      <div className="mx-auto w-full max-w-container px-gutter md:px-gutter-lg">
        <div className="max-w-2xl">
          <p className="lv-mono text-[11px] uppercase tracking-[0.2em] text-verde-700">
            01 / 04 · Producto
          </p>
          <Reveal
            as="h2"
            text="Todo lo que tu negocio necesita para que lo encuentren."
            accent="encuentren"
            className="mt-4 font-lv-display text-[clamp(32px,5vw,52px)] font-bold leading-[1.02] tracking-[-0.04em] text-ink text-balance"
          />
          <Reveal
            as="p"
            text="Una sola ficha para el mapa, la carta, los pedidos y tus redes."
            delay={120}
            className="mt-4 max-w-[50ch] text-base leading-relaxed text-ink-soft/75 text-pretty"
          />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <BentoCard
            index={1}
            title="Pin en el mapa"
            body="Apareces donde la gente busca, con dirección, horario y las monedas que aceptas."
            visual={<MapVisual />}
            className="lg:col-span-3"
          />
          <BentoCard
            id="ejemplos"
            index={2}
            title="Buscador con IA"
            body="Búsquedas en lenguaje natural que entienden barrios, monedas y costumbres cubanas."
            visual={<SearchVisual />}
            className="lg:col-span-3"
          />
          <BentoCard
            index={3}
            title="Menú QR"
            body="Tu carta online, lista para escanear sin descargar nada."
            visual={<QrVisual />}
            className="lg:col-span-2"
          />
          <BentoCard
            index={4}
            title="Pedidos y reservas"
            body="Recibe pedidos y reservas conectados a tu catálogo."
            visual={<OrdersVisual />}
            className="lg:col-span-2"
          />
          <BentoCard
            index={5}
            title="Facebook y Eventos"
            body="Publicaciones y eventos que llevan gente a tu puerta."
            visual={<EventVisual />}
            className="lg:col-span-2"
          />
          <BentoCard
            index={6}
            title="Asistente Telegram"
            body="Tu menú y tu negocio, desde el móvil, hablando. Sin entrar al panel."
            visual={<TelegramVisual />}
            className="lg:col-span-6"
            wide
          />
        </div>
      </div>
    </section>
  );
}
