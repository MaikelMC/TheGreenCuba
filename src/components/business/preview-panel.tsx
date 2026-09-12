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
  { name: "Ropa Vieja de Res", price: "12", currency: "MLC", tag: "Popular", gradient: "linear-gradient(135deg, oklch(75% 0.15 75 / 0.1), oklch(60% 0.20 25 / 0.06))" },
  { name: "Lechón Asado", price: "15", currency: "MLC", gradient: "linear-gradient(135deg, oklch(62% 0.16 145 / 0.08), oklch(70% 0.12 175 / 0.06))" },
  { name: "Mojito de la Casa", price: "5", currency: "MLC", tag: "2x1", gradient: "linear-gradient(135deg, oklch(62% 0.14 250 / 0.08), oklch(62% 0.16 145 / 0.05))" },
];

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
    <div className={cn("bg-muted rounded-lv-lg p-gap-sm flex flex-col lg:flex-row lg:items-start lg:gap-gap-xl lg:p-gap-xl", className)}>
      {/* Phone mockup */}
      <motion.div
        initial={{ opacity: 0, y: 24, rotate: -1 }}
        whileInView={{ opacity: 1, y: 0, rotate: 0 }}
        viewport={{ once: true, margin: "-48px" }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        whileHover={{ y: -4 }}
        className="w-full max-w-[375px] lg:max-w-[340px] mx-auto bg-surface rounded-[32px] border-[3px] border-foreground/15 overflow-hidden shadow-lv-lg relative shrink-0"
      >
        {/* Dynamic Island */}
        <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[120px] h-[32px] bg-foreground rounded-[20px] z-10" />

        {/* Status Bar */}
        <div className="h-[44px] flex items-center justify-between px-6 font-mono text-xs font-semibold">
          <span className="font-bold">9:41</span>
          <span className="flex gap-[4px] items-center">
            <Wifi size={14} strokeWidth={2} />
            <Battery size={14} strokeWidth={2} />
          </span>
        </div>

        {/* Content */}
        <div className="max-h-[500px] overflow-y-auto scrollbar-hide">
          {/* Photo */}
          <div className="aspect-[4/3] bg-gradient-to-br from-accent/12 to-lv-amber/8 flex items-center justify-center text-accent relative">
            <Image size={40} strokeWidth={1.5} className="opacity-40" />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-[4px]">
              <span className="w-4 h-[6px] rounded-full bg-white" />
              <span className="w-[6px] h-[6px] rounded-full bg-foreground/20" />
              <span className="w-[6px] h-[6px] rounded-full bg-foreground/20" />
              <span className="w-[6px] h-[6px] rounded-full bg-foreground/20" />
            </div>
          </div>

          {/* Place Info */}
          <div className="p-gap-md">
            <div className="font-display text-h3 font-bold tracking-[-0.005em]">{businessName}</div>
            <div className="flex items-center gap-gap-xs mt-gap-2xs flex-wrap">
              {isOpen && (
                <span className="font-mono text-[10px] font-medium px-[8px] py-[2px] rounded-full uppercase tracking-[0.04em] bg-lv-teal/12 text-lv-teal">
                  Abierto
                </span>
              )}
              <span className="font-mono text-[10px] font-medium px-[8px] py-[2px] rounded-full uppercase tracking-[0.04em] bg-accent/10 text-accent">
                {category}
              </span>
              <span className="font-mono text-[10px] font-medium px-[8px] py-[2px] rounded-full uppercase tracking-[0.04em] bg-muted text-muted-foreground">
                {distance}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-4 gap-[6px] px-gap-md pb-gap-md">
            <button className="flex flex-col items-center gap-[4px] py-[10px] px-[4px] rounded-lv bg-accent text-white border border-accent cursor-pointer transition-all hover:brightness-110">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              <span className="text-[10px] font-medium font-display">Cómo llegar</span>
            </button>
            {["Guardar", "Compartir", "Quiero ir"].map((label) => (
              <button key={label} className="flex flex-col items-center gap-[4px] py-[10px] px-[4px] rounded-lv border border-border bg-surface cursor-pointer transition-all hover:border-accent hover:bg-accent/10">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-5 text-accent"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                <span className="text-[10px] font-medium font-display">{label}</span>
              </button>
            ))}
          </div>

          {/* AI Recommendation */}
          <div className="mx-gap-md mb-gap-md bg-gradient-to-br from-accent/[0.06] to-accent/[0.02] border border-accent/15 rounded-lv-lg p-gap-sm">
            <div className="flex items-center gap-gap-xs mb-gap-xs">
              <div className="size-7 rounded-[6px] bg-accent grid place-items-center text-white">
                <Sparkles size={14} strokeWidth={2} />
              </div>
              <span className="font-mono text-[10px] text-accent uppercase tracking-[0.04em] font-medium">Recomendación IA</span>
            </div>
            <p className="text-[13px] leading-relaxed text-foreground">
              &ldquo;<strong>cena en el centro de Santiago</strong>&rdquo;. {businessName} tiene cocina cubana y está a {distance} de ti.
            </p>
          </div>

          {/* Menu preview */}
          <div className="px-gap-md pb-gap-md">
            <h3 className="font-display text-small font-bold mb-gap-sm">Menú destacado</h3>
            <div className="flex flex-col gap-gap-sm">
              {menuItems.map((item, i) => (
                <div key={i} className="flex gap-gap-sm items-center">
                  <div className="size-12 rounded-[6px] shrink-0" style={{ background: item.gradient }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-[13px] font-semibold">{item.name}</div>
                    <div className="font-mono text-[11px] text-accent">
                      {item.price} {currencyLabel(item.currency)}
                      {item.tag && (
                        <span className="ml-1 bg-accent/10 text-accent px-[5px] py-[1px] rounded-full text-[9px]">
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
        <h3 className="font-display text-h3 font-bold mb-gap-sm">Cómo se ve en la app</h3>
        <div className="flex flex-col">
          {[
            { label: "Nombre", value: businessName },
            { label: "Categoría", value: category },
            { label: "Estado", value: isOpen ? "Abierto ahora" : "Cerrado", color: isOpen ? "text-lv-teal" : "text-destructive" },
            { label: "Pagos", value: payments.map(currencyLabel).join(", ") },
            { label: "Oferta", value: offer, color: "text-destructive" },
            { label: "Menú items", value: `${menuCount} platos destacados` },
          ].map((field) => (
            <div
              key={field.label}
              className="flex items-center gap-gap-sm py-gap-sm border-b border-border text-small last:border-b-0"
            >
              <span className="w-[120px] font-medium shrink-0">{field.label}</span>
              <span className={cn("flex-1 text-muted-foreground font-mono text-xs", field.color)}>
                {field.value}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-gap-lg p-gap-md bg-muted rounded-lv-lg">
          <div className="font-mono text-xs text-muted-foreground uppercase tracking-[0.04em] mb-gap-xs">
            Consejo
          </div>
          <p className="text-small text-foreground leading-relaxed">
            Edita tu ficha en la pestaña <strong>Editar ficha</strong> y los cambios se reflejan aquí en tiempo real.
          </p>
        </div>
      </div>
    </div>
  );
}
