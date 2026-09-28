"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

/**
 * Reporte de errores desde Configuración.
 *
 * Crea un ticket de soporte (`POST /api/support`): el usuario describe qué
 * falló, la app adjunta la pantalla desde la que escribió y administración lo
 * recibe en su panel y por correo. El aviso de éxito deja claro a dónde fue:
 * el usuario no debe preguntarse si "se envió" de verdad.
 */
export function SupportRequest() {
  const pathname = usePathname();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  /* Sin sesión el endpoint responde 401; se descubre aquí y no al enviar. */
  const [canSend, setCanSend] = useState(false);
  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data: { authenticated?: boolean }) => setCanSend(Boolean(data.authenticated)))
      .catch(() => setCanSend(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, pagePath: pathname }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo enviar el reporte. Inténtalo otra vez.");
        return;
      }
      setSent(true);
      setSubject("");
      setMessage("");
      toast.success("Recibimos tu reporte. Te responderemos por correo.");
    } catch {
      toast.error("No hubo respuesta del servidor. Revisa tu conexión.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex flex-col rounded-2xl border border-ink/5 bg-white px-gap-md shadow-soft">
      <h2 className="pt-gap-md font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600">
        Reportar un error
      </h2>
      <p className="mt-gap-xs text-meta text-ink-soft/75 text-pretty">
        ¿Algo no funciona? Cuéntanos qué pasó y en qué pantalla: nos llega directo
        al equipo.
      </p>

      {sent ? (
        <div className="my-gap-sm p-gap-sm rounded-xl bg-verde-50 border border-verde-200 text-small text-verde-700">
          Reporte enviado. Revisa tu correo: te responderemos a la cuenta de tu
          cuenta La Verde.
        </div>
      ) : canSend ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-gap-xs py-gap-sm">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={150}
            required
            minLength={3}
            placeholder="Asunto: qué falló"
            aria-label="Asunto del reporte"
            className="h-11 rounded-xl border border-ink/10 bg-sand-warm px-3 text-small text-ink outline-none transition-colors focus:border-verde-400 focus:bg-white focus:ring-2 focus:ring-verde-400/20"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={3000}
            required
            minLength={10}
            rows={3}
            placeholder="Describe el problema: qué hiciste, qué esperabas y qué pasó."
            aria-label="Descripción del problema"
            className="min-h-[88px] resize-y rounded-xl border border-ink/10 bg-sand-warm px-3 py-3 text-small text-ink outline-none transition-colors focus:border-verde-400 focus:bg-white focus:ring-2 focus:ring-verde-400/20"
          />
          <button
            type="submit"
            disabled={sending || subject.trim().length < 3 || message.trim().length < 10}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-gap-xs self-start rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 disabled:opacity-50 disabled:pointer-events-none"
          >
            {sending ? <Loader2 size={16} strokeWidth={1.8} className="animate-spin" /> : <Send size={16} strokeWidth={1.8} />}
            {sending ? "Enviando…" : "Enviar reporte"}
          </button>
        </form>
      ) : (
        <p className="py-gap-sm text-meta text-ink-soft/75">
          Inicia sesión para enviar el reporte desde la app, o escríbenos a
          laverdecuba@gmail.com.
        </p>
      )}
    </section>
  );
}
