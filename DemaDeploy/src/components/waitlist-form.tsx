"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  Loader2,
  PartyPopper,
  Phone,
  RotateCcw,
  Store,
  User
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Tipo = "usuario" | "negocio";
type Status = "idle" | "loading" | "success" | "error";

const OPCIONES_TIPO: {
  value: Tipo;
  label: string;
  hint: string;
  icon: typeof User;
}[] = [
  {
    value: "usuario",
    label: "Quiero usarla",
    hint: "busco lugares cerca",
    icon: User
  },
  {
    value: "negocio",
    label: "Tengo un negocio",
    hint: "quiero pertenecer",
    icon: Store
  }
];

interface WaitlistFormProps {
  tipo: Tipo;
  onTipoChange: (tipo: Tipo) => void;
  onReservado?: () => void;
}

export default function WaitlistForm({ tipo, onTipoChange, onReservado }: WaitlistFormProps) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [pos, setPos] = useState<number | null>(null);
  const reduce = useReducedMotion();

  const puedeEnviar =
    nombre.trim().length >= 2 && telefono.trim().replace(/[^\d]/g, "").length >= 7;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeEnviar) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          tipo,
          source: "preview"
        })
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setPos(data?.position ?? null);
        setStatus("success");
        onReservado?.();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  const reset = () => {
    setStatus("idle");
    setNombre("");
    setTelefono("");
    onTipoChange("usuario");
  };

  const nombreCorto = nombre.trim().split(/\s+/)[0] || "vecino";

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
              ¡Listo, {nombreCorto}!
            </h3>
            {tipo === "negocio" ? (
              <p className="mt-2 text-sm leading-relaxed text-ink-soft/80">
                Anotamos tu negocio en la lista de pertenencia. Te llamamos al{" "}
                <span className="font-semibold text-verde-700">{telefono}</span> en
                cuanto abra la puerta.
              </p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-ink-soft/80">
                Anotamos tu número{" "}
                <span className="font-semibold text-verde-700">{telefono}</span>.
                Te avisamos apenas abra la puerta.
              </p>
            )}
            {pos ? (
              <p className="mt-3 text-sm text-ink-soft/80">
                Eres el número{" "}
                <span className="font-display text-lg font-bold text-verde-600">
                  {pos}
                </span>{" "}
                de la lista.
              </p>
            ) : null}
            <button
              onClick={reset}
              className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-verde-700 transition-colors hover:text-verde-600"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
              Anotar a otro
            </button>
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
              <div className="rounded-[calc(2rem-10px)] bg-white p-2">
                {/* Tipo: usar o pertenecer */}
                <div className="grid grid-cols-2 gap-1 rounded-2xl bg-sand p-1">
                  {OPCIONES_TIPO.map((o) => {
                    const active = tipo === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => onTipoChange(o.value)}
                        className={cn(
                          "flex flex-col items-center gap-0.5 rounded-xl px-3 py-2.5 text-center transition-all duration-300",
                          active
                            ? "bg-verde-600 text-white shadow-soft"
                            : "text-ink-soft/70 hover:bg-white"
                        )}
                        aria-pressed={active}
                      >
                        <span className="flex items-center gap-1.5 text-sm font-bold">
                          <o.icon className="h-4 w-4" strokeWidth={2} />
                          {o.label}
                        </span>
                        <span
                          className={cn(
                            "text-[10px]",
                            active ? "text-verde-100" : "text-ink-soft/50"
                          )}
                        >
                          {o.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {tipo === "negocio" && (
                  <p className="mt-1.5 px-2 text-[11px] text-ink-soft/50">
                    Solo abrimos 25 cupos para negocios en esta tanda.
                  </p>
                )}

                {/* Nombre */}
                <div className="mt-2 flex items-center gap-2 rounded-2xl bg-sand/60 px-3.5 transition-colors focus-within:bg-sand">
                  <User className="h-4 w-4 shrink-0 text-verde-600" strokeWidth={2} />
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder={
                      tipo === "negocio" ? "Nombre de tu negocio" : "Tu nombre"
                    }
                    aria-label="Nombre"
                    className="w-full bg-transparent py-3 text-sm text-ink placeholder:text-ink-soft/40 focus:outline-none"
                  />
                </div>

                {/* Teléfono */}
                <div className="mt-2 flex items-center gap-2 rounded-2xl bg-sand/60 px-3.5 transition-colors focus-within:bg-sand">
                  <Phone className="h-4 w-4 shrink-0 text-verde-600" strokeWidth={2} />
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="+53 5 1234567"
                    aria-label="Número de teléfono"
                    className="w-full bg-transparent py-3 text-sm text-ink placeholder:text-ink-soft/40 focus:outline-none"
                  />
                </div>
                <p className="mt-1.5 px-2 text-[11px] text-ink-soft/50">
                  Te contactamos por llamada o WhatsApp, sin spam.
                </p>

                <button
                  type="submit"
                  disabled={!puedeEnviar || status === "loading"}
                  className={cn(
                    "btn-pill mt-3 w-full bg-verde-600 py-3.5 text-white shadow-soft hover:bg-verde-500 disabled:cursor-not-allowed disabled:opacity-50"
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

      <div className="mt-5 flex items-center justify-center gap-6 text-xs text-white/75">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-verde-300" strokeWidth={2} />
          Sin spam, sin compromiso
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-verde-300" strokeWidth={2} />
          Recomendado por gente local
        </span>
      </div>
    </div>
  );
}