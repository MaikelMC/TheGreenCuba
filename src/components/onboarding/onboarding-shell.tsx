import { type ReactNode } from "react";

export function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-full max-w-[480px] mx-auto bg-surface relative overflow-hidden shadow-[0_0_0_1px] shadow-border sm:my-6 sm:h-[calc(100%-48px)] sm:rounded-lv-xl">
      {children}
    </div>
  );
}

export function StatusBar() {
  return (
    <div className="flex justify-between items-center px-5 pt-2 pb-1 font-mono text-xs font-semibold text-foreground flex-shrink-0 min-h-[36px]">
      <span className="font-bold">9:41</span>
      <div className="flex gap-1 items-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4">
          <path d="M19 10v4M15 8v6M11 12v2M7 6v8" />
          <rect x="2" y="4" width="20" height="16" rx="2" />
        </svg>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4">
          <path d="M1 9l4 4 4-4M13 9l4 4 4-4" />
        </svg>
      </div>
    </div>
  );
}
