"use client";

import { useEffect, useState, type ReactNode } from "react";
import { isAdminAuthed } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { LockScreen } from "@/components/admin/lock-screen";
import { PlacesProvider } from "@/providers/places-provider";
import { LoadingState } from "@/components/ui/loading";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAuthed(isAdminAuthed());
    setReady(true);
  }, []);

  // `loading.tsx` no cubre este caso: el layout se renderiza antes que sus hijos,
  // así que sin esto la pantalla queda en blanco mientras se comprueba la sesión.
  if (!ready) {
    return (
      <div className="grid min-h-screen min-h-dvh place-items-center">
        <LoadingState label="Comprobando sesión…" />
      </div>
    );
  }

  if (!authed) {
    return <LockScreen onSuccess={() => setAuthed(true)} />;
  }

  return (
    <PlacesProvider>
      <AdminShell>{children}</AdminShell>
    </PlacesProvider>
  );
}
