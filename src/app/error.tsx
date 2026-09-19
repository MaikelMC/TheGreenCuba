"use client";

import { ErrorState } from "@/components/ui";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-screen min-h-dvh place-items-center bg-sand font-lv text-ink px-gutter">
      <ErrorState error={error} reset={reset} />
    </div>
  );
}
