"use client";

import { ErrorState } from "@/components/ui";

/** El layout de (main) ya aporta alto y padding; aquí solo centramos. */
export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-[70vh] place-items-center px-gutter">
      <ErrorState error={error} reset={reset} />
    </div>
  );
}
