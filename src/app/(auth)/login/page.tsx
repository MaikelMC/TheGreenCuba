"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    // Auth real no está implementado; el acceso a la app pasa por el onboarding.
    router.push("/onboarding");
  }

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <Link href="/" className="font-display text-xl font-bold tracking-tight text-foreground">
        La Verde
      </Link>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lv-lg border border-border p-8 text-center animate-fade-in-up"
      >
        <p className="text-muted-foreground mb-6">Inicia sesión para continuar</p>
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lv bg-accent px-6 py-3 font-display text-[15px] font-semibold leading-none text-accent-foreground transition-colors duration-200 hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}