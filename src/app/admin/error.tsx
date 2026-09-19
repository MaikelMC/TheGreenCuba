"use client";

import { ErrorState } from "@/components/ui";

/** Se renderiza dentro de AdminShell, así que el panel sigue visible. */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      className="rounded-2xl border border-ink/5 bg-white shadow-soft"
      error={error}
      reset={reset}
      title="El panel encontró un error"
      description="No pudimos cargar esta sección del panel. Reintenta; si persiste, recarga la página."
    />
  );
}
