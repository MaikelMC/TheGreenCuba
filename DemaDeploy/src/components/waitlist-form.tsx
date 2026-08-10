"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Loader2, Mail, PartyPopper } from "lucide-react";
import { useState } from "react";
import Reveal from "@/components/ui/reveal";
import Counter from "@/components/ui/counter";
import { cn } from "@/lib/utils";

type Status = "idle" | "loading" | "success" | "error";

export default function WaitlistForm({
  initialState = ""
}: {
  initialState?: string;
}) {
  const [email, setEmail] = useState(initialState);
  const [status, setStatus] = useState<Status>("idle");
  const [pos, setPos] = useState<number | null>(null);
  const reduce = useReducedMotion();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, source: "preview" })
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setPos(data?.position ?? null);
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <AnimatePresence mode="wait">
        {status === "success" ? (
          <motion.div
            key="success"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-4xl border border-verde-400/30 bg-verde-50/70 p-8 text-center"
          >
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-verde-100 text-verde-700">
              <PartyPopper className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <h3 className="mt-4 font-display text-2xl font-bold text-ink">
              ¡Listo, {email.split("@")[0] || "vecino"}!
            </h3>
            {pos ? (
              <p className="mt-2 text-sm text-ink-soft/80">
                Eres el número{" "}
                <span className="font-display text-lg font-bold text-verde-600">{pos}</span>{" "}
                de la lista. Te avisamos apenas abra la puerta.
              </p>
            ) : (
              <p className="mt-2 text-sm text-ink-soft/80">
                Te avisamos apenas abra la puerta. Revisa tu bandeja.
              </p>
            )}
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={submit}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="shell-light"
          >
            <div className="core p-2">
              <div className="flex flex-col gap-2 rounded-[calc(2rem-10px)] bg-white p-1.5 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-2 px-3">
                  <Mail className="h-4 w-4 shrink-0 text-verde-500" strokeWidth={2} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tucorreo@ejemplo.com"
                    aria-label="Correo electrónico"
                    className="w-full bg-transparent py-3 text-sm text-ink placeholder:text-ink-soft/40 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className={cn(
                    "btn-pill shrink-0 rounded-full bg-verde-600 px-6 py-3 text-white shadow-soft hover:bg-verde-500 disabled:opacity-70",
                    "text-sm font-bold"
                  )}
                >
                  {status === "loading" ? (
                    <Loader2
                      className={cn("h-4 w-4", reduce ? "" : "animate-spin")}
                      strokeWidth={2}
                    />
                  ) : (
                    <span className="font-bold">Reservar cupo →</span>
                  )}
                </button>
              </div>
            </div>
            {status === "error" && (
              <p className="mt-3 px-2 text-center text-xs text-red-500">
                Algo salió mal. Inténtalo de nuevo en un momento.
              </p>
            )}
          </motion.form>
        )}
      </AnimatePresence>

      <div className="mt-5 flex items-center justify-center gap-6 text-xs text-ink-soft/60">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-verde-500" strokeWidth={2} />
          Sin spam, sin compromiso
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-verde-500" strokeWidth={2} />
          <Counter to={1240} format={(n) => `${n}`} /> ya en la lista
        </span>
      </div>
    </div>
  );
}