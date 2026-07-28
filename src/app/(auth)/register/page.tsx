"use client";

import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <Link href="/" className="font-display text-xl font-bold tracking-tight text-foreground">
        La Verde
      </Link>
      <div className="w-full max-w-sm rounded-lv-lg border border-border p-8 text-center">
        <p className="text-muted-foreground">Registro próximamente</p>
      </div>
    </div>
  );
}
