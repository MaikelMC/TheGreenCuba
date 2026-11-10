"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SUPPORT_WHATSAPP } from "@/lib/legal";
import type { ServicioContent } from "@/content/servicios";

interface Props {
  servicio: Pick<ServicioContent, "nombre" | "anclaPanel">;
  tieneServicio: boolean;
  tieneNegocio: boolean;
  esAutenticado: boolean;
}

export function CtaServicio({
  servicio,
  tieneServicio,
  tieneNegocio,
  esAutenticado,
}: Props) {
  const textoWa = `Hola, quiero saber más sobre el servicio «${servicio.nombre}» en La Verde`;
  const waHref = `https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, "")}?text=${encodeURIComponent(textoWa)}`;

  if (tieneServicio) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="flex-1">
          <Link href={servicio.anclaPanel}>Ir al panel</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="flex-1">
          <a href={waHref} target="_blank" rel="noopener noreferrer">
            Escribir por WhatsApp
          </a>
        </Button>
      </div>
    );
  }

  if (esAutenticado && tieneNegocio) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="flex-1">
          <a href={waHref} target="_blank" rel="noopener noreferrer">
            Contratar por WhatsApp
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button asChild size="lg" className="flex-1">
        <a href={waHref} target="_blank" rel="noopener noreferrer">
          Preguntar por WhatsApp
        </a>
      </Button>
      {!esAutenticado && (
        <Button asChild variant="outline" size="lg" className="flex-1">
          <Link href="/sign-in">Iniciar sesión</Link>
        </Button>
      )}
    </div>
  );
}
