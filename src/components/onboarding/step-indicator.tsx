"use client";

import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepBar({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="flex gap-[6px] px-5 pb-4 pt-2 flex-shrink-0">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex-1 h-1 rounded-full transition-all duration-300",
            i <= currentStep ? "bg-accent" : "bg-[oklch(82%_0.006_250)]",
          )}
        />
      ))}
    </div>
  );
}

export function StepDots({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="flex justify-center gap-2 px-5 py-4 flex-shrink-0">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-2 rounded-full transition-all duration-300",
            i === currentStep
              ? "bg-accent w-6 rounded-[4px]"
              : i < currentStep
                ? "bg-accent w-2"
                : "bg-[oklch(82%_0.006_250)] w-2",
          )}
        />
      ))}
    </div>
  );
}
