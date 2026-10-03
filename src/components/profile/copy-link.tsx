"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

/**
 * El enlace del afiliado, con su botón de copiar.
 *
 * Cliente porque el portapapeles no existe en el servidor y el acuse de
 * «copiado» es estado. No se reusa `src/lib/share.ts`: aquel es de la ficha de
 * lugar, abre la hoja nativa y lleva su propio seguimiento, y aquí lo que hace
 * falta es dejar el enlace en el portapapeles —el afiliado lo pega donde quiera,
 * casi siempre WhatsApp—.
 *
 * Si el portapapeles falla —permisos, un navegador sin contexto seguro— el texto
 * del enlace está a la vista y se selecciona a mano, así que el aviso lo dice.
 */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      toast.error("No se pudo copiar. Selecciona el enlace y cópialo a mano.");
      return;
    }
    setCopied(true);
    toast.success("Enlace copiado");
    window.setTimeout(() => setCopied(false), 2000);
  }, [url]);

  return (
    <div className="flex flex-col gap-gap-sm rounded-2xl border border-ink/10 bg-white p-gap-md shadow-soft sm:flex-row sm:items-center">
      <code className="min-w-0 flex-1 break-all font-lv-display text-small text-ink">
        {url}
      </code>
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-colors duration-500 ease-outquint hover:bg-verde-300 cursor-pointer"
      >
        {copied ? (
          <Check size={16} strokeWidth={1.8} />
        ) : (
          <Copy size={16} strokeWidth={1.8} />
        )}
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
