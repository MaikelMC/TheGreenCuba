"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth/client";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordFallback() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-gap-md py-gap-xl">
      <section className="w-full rounded-3xl border border-ink/10 bg-white p-gap-lg shadow-soft">
        <div className="mb-gap-md flex items-center gap-gap-sm text-verde-700">
          <KeyRound size={21} />
          <h1 className="font-lv-display text-h3 font-bold text-ink">Restablecer contraseña</h1>
        </div>
        <div className="flex items-center justify-center py-6 text-small text-ink-soft">
          <Loader2 size={16} className="mr-2 animate-spin" />
          Cargando...
        </div>
      </section>
    </main>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!token) {
      setError("El enlace de restablecimiento no es válido o ya expiró.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    const result = await authClient.resetPassword({ newPassword: password, token });
    if (result.error) {
      setError("No se pudo cambiar la contraseña. Solicita un enlace nuevo.");
    } else {
      setMessage("Contraseña actualizada. Ya puedes iniciar sesión.");
      setPassword("");
      setConfirmation("");
    }
    setLoading(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-gap-md py-gap-xl">
      <section className="w-full rounded-3xl border border-ink/10 bg-white p-gap-lg shadow-soft">
        <div className="mb-gap-md flex items-center gap-gap-sm text-verde-700">
          <KeyRound size={21} />
          <h1 className="font-lv-display text-h3 font-bold text-ink">Restablecer contraseña</h1>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-gap-md">
          <label className="flex flex-col gap-gap-xs text-small text-ink-soft">
            Nueva contraseña
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" className="h-12 rounded-xl border border-ink/10 px-3 text-ink outline-none focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20" />
          </label>
          <label className="flex flex-col gap-gap-xs text-small text-ink-soft">
            Repetir contraseña
            <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} autoComplete="new-password" className="h-12 rounded-xl border border-ink/10 px-3 text-ink outline-none focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20" />
          </label>
          {error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-meta text-destructive">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-verde-200 bg-verde-50 px-3 py-2 text-meta text-verde-700">{message}</p>}
          <button type="submit" disabled={loading} className="inline-flex h-12 items-center justify-center gap-gap-xs rounded-full bg-verde-600 px-4 font-lv-display text-small font-semibold text-white disabled:opacity-60">
            {loading && <Loader2 size={16} className="animate-spin" />}
            Cambiar contraseña
          </button>
        </form>
      </section>
    </main>
  );
}
