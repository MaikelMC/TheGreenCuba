"use client";

import { useEffect, useState, type ReactNode } from "react";
import { isAdminAuthed } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { LockScreen } from "@/components/admin/lock-screen";
import { PlacesProvider } from "@/providers/places-provider";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAuthed(isAdminAuthed());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!authed) {
    return <LockScreen onSuccess={() => setAuthed(true)} />;
  }

  return (
    <PlacesProvider>
      <AdminShell>{children}</AdminShell>
    </PlacesProvider>
  );
}
