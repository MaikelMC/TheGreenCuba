"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({
  title,
  icon,
  defaultOpen = true,
  children,
  className,
}: FormSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("bg-surface border border-border rounded-lv-lg overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center justify-between w-full p-gap-md border-b border-border hover:bg-muted/50 transition-colors duration-fast"
      >
        <span className="font-display text-body font-semibold flex items-center gap-gap-xs">
          {icon && <span className="text-accent">{icon}</span>}
          {title}
        </span>
        <ChevronDown
          size={18}
          strokeWidth={1.5}
          className={cn(
            "text-muted-foreground transition-transform duration-normal",
            !open && "-rotate-90",
          )}
        />
      </button>
      {open && (
        <div className="p-gap-md flex flex-col gap-gap-md">
          {children}
        </div>
      )}
    </div>
  );
}
