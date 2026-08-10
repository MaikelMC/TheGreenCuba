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
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lv bg-accent px-6 py-3 font-display text-[15px] font-semibold leading-none text-accent-foreground shadow-[0_1px_3px_oklch(62%_0.16_145/0.25)] transition-all duration-200 active:translate-y-px hover:bg-accent-hover hover:shadow-[0_4px_12px_oklch(62%_0.16_145/0.3)]",
        fullWidth && "w-full",
        className,
      )}
    >
      Unirse a la lista
    </button>
  );
}
