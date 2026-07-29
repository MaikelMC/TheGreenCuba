"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, Building2 } from "lucide-react";

export function UserMenu({ initial }: { initial?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router],
  );

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="size-9 rounded-full bg-accent/10 border-2 border-border grid place-items-center text-accent font-display font-bold text-[14px] hover:border-accent transition-colors"
        aria-label="Menú de usuario"
      >
        {initial ?? "M"}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] w-[200px] bg-surface border border-border rounded-lv-lg shadow-lv-lg z-50 overflow-hidden">
          <button
            type="button"
            onClick={() => handleSelect("/profile")}
            className="w-full flex items-center gap-gap-sm px-gap-md py-[10px] text-small text-foreground hover:bg-accent/10 transition-colors text-left"
          >
            <User size={16} strokeWidth={2} className="text-accent shrink-0" />
            Perfil de usuario
          </button>
          <div className="h-[1px] bg-border mx-gap-md" />
          <button
            type="button"
            onClick={() => handleSelect("/business")}
            className="w-full flex items-center gap-gap-sm px-gap-md py-[10px] text-small text-foreground hover:bg-accent/10 transition-colors text-left"
          >
            <Building2 size={16} strokeWidth={2} className="text-accent shrink-0" />
            Business panel
          </button>
        </div>
      )}
    </div>
  );
}
