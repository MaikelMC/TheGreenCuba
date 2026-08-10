"use client";

import dynamic from "next/dynamic";

// Wrapper client: ssr:false no se permite en Server Components, y el diálogo
// solo se abre por click. Cargarlo bajo demanda quita el stack de radix Dialog
// (~15-25kb) del primer paint de la landing.
export const WaitlistDialog = dynamic(
  () =>
    import("@/components/landing/waitlist-dialog").then((m) => m.WaitlistDialog),
  { ssr: false, loading: () => null },
);
