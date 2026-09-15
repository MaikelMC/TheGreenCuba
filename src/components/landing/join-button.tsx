"use client";

import { useWaitlistDialog } from "@/store/waitlist-dialog";
import { cn } from "@/lib/utils";

interface JoinButtonProps {
  className?: string;
  fullWidth?: boolean;
}

export function JoinButton({ className, fullWidth }: JoinButtonProps) {
  const { openDialog } = useWaitlistDialog();

  return (
    <button
      type="button"
      onClick={openDialog}
      className={cn(
        // `.btn-pill` del design system: pastilla, transición de 500 ms con
        // easeOutQuint en línea, y halo del propio verde del botón.
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-verde-400 px-6 py-3 font-lv-display text-sm font-semibold leading-none text-verde-950",
        "shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)]",
        "transition-all duration-500 ease-outquint",
        "hover:bg-verde-300 active:scale-[0.98]",
        fullWidth && "w-full",
        className,
      )}
    >
      Registrarse
    </button>
  );
}
