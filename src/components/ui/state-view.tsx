import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StateVariant = "empty" | "error" | "offline";
type StateSize = "sm" | "lg";

/**
 * Lenguaje visual único para los estados vacío / error del sitio.
 * `empty` usa el tinte de acento; `error` y `offline` el destructivo.
 * `sm` va dentro de tarjetas del panel; `lg` ocupa una página o una hoja.
 */
const VARIANT_TONE: Record<StateVariant, string> = {
  empty: "bg-accent/10 text-accent",
  error: "bg-destructive/8 text-destructive",
  offline: "bg-destructive/8 text-destructive",
};

const SIZES: Record<
  StateSize,
  { wrapper: string; badge: string; icon: number; title: string; desc: string }
> = {
  lg: {
    wrapper: "py-10 px-5",
    badge: "size-16 mb-gap-md",
    icon: 28,
    title: "text-[18px] mb-2",
    desc: "text-[14px] max-w-[32ch]",
  },
  sm: {
    wrapper: "py-gap-lg px-gap-sm",
    badge: "size-11 mb-gap-sm",
    icon: 20,
    title: "text-small mb-[4px]",
    desc: "text-meta max-w-[38ch]",
  },
};

export interface StateViewProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: StateVariant;
  /** Icono de lucide-react. Se dimensiona solo según `size`. */
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  /** Botones o chips. Normalmente `Button` de `@/components/ui`. */
  actions?: React.ReactNode;
  size?: StateSize;
}

const StateView = React.forwardRef<HTMLDivElement, StateViewProps>(
  (
    { className, variant = "empty", icon: Icon, title, description, actions, size = "lg", ...props },
    ref,
  ) => {
    const s = SIZES[size];
    return (
      <div
        ref={ref}
        role={variant === "empty" ? undefined : "alert"}
        className={cn("text-center", s.wrapper, className)}
        {...props}
      >
        {Icon ? (
          <div
            className={cn(
              "grid place-items-center mx-auto rounded-full",
              s.badge,
              VARIANT_TONE[variant],
            )}
          >
            <Icon size={s.icon} strokeWidth={1.8} />
          </div>
        ) : null}

        <h3
          className={cn(
            "font-display font-semibold text-foreground mx-auto",
            s.title,
          )}
        >
          {title}
        </h3>

        {description ? (
          <div className={cn("text-muted-foreground mx-auto", s.desc)}>{description}</div>
        ) : null}

        {actions ? (
          <div className="flex flex-wrap items-center justify-center gap-gap-xs mt-gap-md">
            {actions}
          </div>
        ) : null}
      </div>
    );
  },
);
StateView.displayName = "StateView";

export { StateView };
