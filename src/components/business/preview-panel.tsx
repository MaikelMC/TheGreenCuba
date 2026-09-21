"use client";

import { motion } from "motion/react";
import { Wifi, Battery, Sparkles, Image } from "lucide-react";
import { cn, currencyLabel } from "@/lib/utils";

interface MenuPreviewItem {
  name: string;
  price: string;
  currency: string;
  tag?: string;
  gradient: string;
}

interface PreviewPanelProps {
  businessName?: string;
  category?: string;
  distance?: string;
  isOpen?: boolean;
  payments?: string[];
  offer?: string;
  menuItems?: MenuPreviewItem[];
  menuCount?: number;
  className?: string;
}

const DEFAULT_MENU: MenuPreviewItem[] = [
  { name: "Ropa Vieja de Res", price: "12", currency: "MLC", tag: "Popular", gradient: "linear-gradient(135deg, #EAF7EF, #CEEEDB)" },
  { name: "Lechón Asado", price: "15", currency: "MLC", gradient: "linear-gradient(135deg, #CEEEDB, #EAF7EF)" },
  { name: "Mojito de la Casa", price: "5", currency: "MLC", tag: "2x1", gradient: "linear-gradient(135deg, #F6F3EC, #EAE4D6)" },
];

/** Chapita de la ficha dentro del móvil. */
const CHIP =
  "font-lv-display text-[10px] font-semibold px-[10px] py-[3px] rounded-full uppercase tracking-[0.16em]";

export function PreviewPanel({
  businessName = "St. Pauli Restaurant-Bar",
  category = "Restaurante",
  distance = "0.8 km",
  isOpen = true,
  payments = ["CUP"],
  offer = "2x1 en mojitos los jueves",
  menuItems = DEFAULT_MENU,
  menuCount = 3,
  className,
}: PreviewPanelProps) {
  return (
    <div className={cn("bg-sand rounded-4xl p-gap-sm flex flex-col lg:flex-row lg:items-start lg:gap-gap-xl lg:p-gap-xl", className)}>
      {/* Phone mockup */}
      <motion.div
        initial={{ opacity: 0, y: 24, rotate: -1 }}
        whileInView={{ opacity: 1, y: 0, rotate: 0 }}
        viewport={{ once: true, margin: "-48px" }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        whileHover={{ y: -4 }}
        className="w-full max-w-[375px] lg:max-w-[340px] mx-auto bg-white rounded-[32px] border-[3px] border-ink/10 overflow-hidden shadow-card relative shrink-0"
      >
        {/* Dynamic Island */}
        <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[120px] h-[32px] bg-ink rounded-[20px] z-10" />

        {/* Status Bar */}
        <div className="h-[44px] flex items-center justify-between px-6 font-lv-display text-meta font-semibold text-ink">
          <span className="font-bold">9:41</span>
          <span className="flex gap-[4px] items-center">
            <Wifi size={14} strokeWidth={1.8} />
            <Battery size={14} strokeWidth={1.8} />
          </span>
        </div>

        {/* Content */}
        <div className="max-h-[500px] overflow-y-auto scrollbar-hide">
          {/* Photo */}
          <div className="aspect-[4/3] bg-gradient-to-br from-verde-50 to-verde-100 flex items-center justify-center text-verde-400 relative">
            <Image size={40} strokeWidth={1.8} className="opacity-40" />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-[4px]">
              <span className="w-4 h-[6px] rounded-full bg-verde-400" />
              <span className="w-[6px] h-[6px] rounded-full bg-ink/20" />
              <span className="w-[6px] h-[6px] rounded-full bg-ink/20" />
              <span className="w-[6px] h-[6px] rounded-full bg-ink/20" />
            </div>
          </div>

          {/* Place Info */}
          <div className="p-gap-md">
            <div className="font-lv-display text-h3 font-bold text-ink tracking-[-0.02em]">{businessName}</div>
            <div className="flex items-center gap-gap-xs mt-gap-2xs flex-wrap">
              {isOpen && (
                <span className={cn(CHIP, "bg-verde-100 text-verde-700")}>
                  Abierto
                </span>
              )}
              <span className={cn(CHIP, "bg-verde-50 text-verde-600")}>
                {category}
              </span>
              <span className={cn(CHIP, "bg-sand-deep text-ink-soft/75")}>
                {distance}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-4 gap-[6px] px-gap-md pb-gap-md">
            <button className="flex flex-col items-center gap-[4px] py-[10px] px-[4px] rounded-xl bg-verde-400 text-verde-950 border border-verde-400 cursor-pointer transition-colors duration-500 ease-outquint hover:bg-verde-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              <span className="text-[10px] font-medium font-lv-display">Cómo llegar</span>
            </button>
            {["Guardar", "Compartir", "Quiero ir"].map((label) => (
              <button key={label} className="flex flex-col items-center gap-[4px] py-[10px] px-[4px] rounded-xl border border-ink/10 bg-white text-ink-soft/75 cursor-pointer transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5 text-verde-600"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                <span className="text-[10px] font-medium font-lv-display">{label}</span>
              </button>
            ))}
          </div>

          {/* AI Recommendation */}
          <div className="mx-gap-md mb-gap-md bg-verde-50 border border-verde-200 rounded-2xl p-gap-sm">
            <div className="flex items-center gap-gap-xs mb-gap-xs">
              <div className="size-7 rounded-xl bg-gradient-to-br from-verde-400 to-verde-600 grid place-items-center text-white">
                <Sparkles size={14} strokeWidth={1.8} />
              </div>
              <span className="font-lv-display text-[10px] text-verde-600 uppercase tracking-[0.22em] font-semibold">Recomendación IA</span>
            </div>
            <p className="text-[13px] leading-relaxed text-ink">
              &ldquo;<strong>cena en el centro de Santiago</strong>&rdquo;. {businessName} tiene cocina cubana y está a {distance} de ti.
            </p>
          </div>

          {/* Menu preview */}
          <div className="px-gap-md pb-gap-md">
            {/* Mismo título que la sección de la ficha: el dueño ve aquí lo que
                verá quien mire su negocio. */}
            <h3 className="font-lv-display text-small font-bold text-ink mb-gap-sm">Lo que ofrece</h3>
            <div className="flex flex-col gap-gap-sm">
              {menuItems.map((item, i) => (
                <div key={i} className="flex gap-gap-sm items-center">
                  <div className="size-12 rounded-xl shrink-0" style={{ background: item.gradient }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-lv-display text-[13px] font-semibold text-ink">{item.name}</div>
                    <div className="font-lv-display text-meta text-verde-600">
                      {item.price} {currencyLabel(item.currency)}
                      {item.tag && (
                        <span className="ml-1 bg-verde-100 text-verde-700 px-[6px] py-[1px] rounded-full text-[9px]">
                          {item.tag}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Live info (desktop) */}
      <div className="hidden lg:block flex-1 py-gap-md">
        <h3 className="font-lv-display text-h3 font-bold text-ink mb-gap-sm">Cómo se ve en la app</h3>
        <div className="flex flex-col">
          {[
            { label: "Nombre", value: businessName },
            { label: "Categoría", value: category },
            { label: "Estado", value: isOpen ? "Abierto ahora" : "Cerrado", color: isOpen ? "text-verde-600" : "text-destructive" },
            { label: "Pagos", value: payments.map(currencyLabel).join(", ") },
            { label: "Oferta", value: offer, color: "text-verde-600" },
            { label: "Productos", value: `${menuCount} productos o servicios` },
          ].map((field) => (
            <div
              key={field.label}
              className="flex items-center gap-gap-sm py-gap-sm border-b border-ink/5 text-small last:border-b-0"
            >
              <span className="w-[120px] font-medium text-ink shrink-0">{field.label}</span>
              <span className={cn("flex-1 text-ink-soft/75 font-lv-display text-meta", field.color)}>
                {field.value}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-gap-lg p-gap-md bg-white border border-ink/5 rounded-2xl shadow-soft">
          <div className="font-lv-display text-[10px] font-semibold text-verde-600 uppercase tracking-[0.22em] mb-gap-xs">
            Consejo
          </div>
          <p className="text-small text-ink leading-relaxed">
            Edita tu ficha en la pestaña <strong>Editar ficha</strong> y los cambios se reflejan aquí en tiempo real.
          </p>
        </div>
      </div>
    </div>
  );
}
