"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Lock, ArrowLeft } from "lucide-react";
import { setAdminAuthed } from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EASE } from "@/lib/motion";

export function LockScreen({ onSuccess }: { onSuccess: () => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!key.trim() || loading) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim() }),
      });
      if (res.ok) {
        setAdminAuthed(key.trim());
        onSuccess();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [key, loading, onSuccess]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-gutter">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <Link
          href="/home"
          className="inline-flex items-center gap-2 text-small text-muted-foreground hover:text-foreground transition-colors mb-gap-lg"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Volver al inicio
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.08, duration: 0.45, ease: EASE }}
        className="w-full max-w-sm rounded-lv-lg border border-border bg-surface p-gap-lg"
      >
        <motion.div
          animate={error ? { x: [0, -8, 8, -5, 5, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="size-12 rounded-lv bg-accent/10 grid place-items-center text-accent mx-auto mb-gap-sm"
        >
          <Lock size={22} strokeWidth={1.8} />
        </motion.div>
        <h1 className="font-display text-h3 font-bold text-center text-foreground">
          Panel de administración
        </h1>
        <p className="text-meta text-muted-foreground text-center mt-gap-2xs mb-gap-md">
          Introduce la clave de administrador para continuar.
        </p>

        <motion.div
          animate={error ? { x: [0, -8, 8, -5, 5, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          <Input
            type="password"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Clave de administrador"
            autoFocus
          />
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-[12px] text-destructive mt-gap-xs"
            >
              Clave incorrecta. Inténtalo de nuevo.
            </motion.p>
          )}
        </AnimatePresence>

        <Button className="w-full mt-gap-sm" onClick={handleSubmit} disabled={loading}>
          <Lock size={18} strokeWidth={1.5} />
          {loading ? "Verificando..." : "Entrar"}
        </Button>
      </motion.div>
    </div>
  );
}
