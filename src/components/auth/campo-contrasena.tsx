"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

/* Mismas clases que el resto de campos de acceso (`auth-card.tsx`). */
const FIELD =
  "auth-field flex items-center gap-gap-sm rounded-xl border border-ink/10 bg-sand-warm pl-gap-sm pr-1 h-12 transition-colors duration-500 ease-outquint focus-within:border-verde-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-verde-400/20";
const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/75";

/**
 * Campo de contraseña con botón para verla.
 *
 * En el móvil una errata en un campo oculto no se ve, y el resultado es un
 * «contraseña incorrecta» con la contraseña que la persona cree haber escrito.
 * El botón deja comprobarla antes de enviar. Se usa en el acceso, el alta y la
 * contraseña nueva.
 */
export function CampoContrasena({
  etiqueta,
  value,
  onChange,
  autoComplete,
  invalido,
  descritoPor,
}: {
  etiqueta: string;
  value: string;
  onChange: (valor: string) => void;
  autoComplete: "current-password" | "new-password";
  invalido?: boolean;
  /** Id del mensaje de error, para que el lector de pantalla lo lea con el campo. */
  descritoPor?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="flex flex-col gap-gap-xs">
      <span className={LABEL}>{etiqueta}</span>
      <span className={FIELD}>
        <Lock size={16} strokeWidth={1.8} className="text-ink-soft/75 shrink-0" aria-hidden />
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          aria-invalid={invalido || undefined}
          aria-describedby={invalido ? descritoPor : undefined}
          className="flex-1 min-w-0 bg-transparent text-small text-ink outline-none placeholder:text-ink-soft/75"
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          /* 44 px de objetivo, el mínimo del proyecto para el pulgar; el
             margen negativo lo mete en el campo de 48 sin agrandarlo. */
          className="-my-1 grid size-11 shrink-0 place-items-center rounded-full text-ink-soft/75 transition-colors duration-300 ease-outquint hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
        >
          {visible ? (
            <EyeOff size={17} strokeWidth={1.8} aria-hidden />
          ) : (
            <Eye size={17} strokeWidth={1.8} aria-hidden />
          )}
        </button>
      </span>
    </label>
  );
}
