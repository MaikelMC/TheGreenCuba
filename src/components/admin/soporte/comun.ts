import type {
  ConversacionSoporte,
  TonoSoporte,
} from "@/lib/admin-soporte";

export const ESTADO_CONVERSACION: Record<
  ConversacionSoporte["status"],
  { etiqueta: string; tono: TonoSoporte }
> = {
  open: { etiqueta: "Abierta", tono: "aviso" },
  in_progress: { etiqueta: "En curso", tono: "info" },
  resolved: { etiqueta: "Resuelta", tono: "ok" },
  closed: { etiqueta: "Archivada", tono: "neutra" },
};

export const FECHA_HORA = new Intl.DateTimeFormat("es-CU", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Havana",
});

export const FECHA = new Intl.DateTimeFormat("es-CU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Havana",
});

export function iniciales(nombre: string): string {
  return (
    nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? "")
      .join("") || "·"
  );
}

export function duracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}
