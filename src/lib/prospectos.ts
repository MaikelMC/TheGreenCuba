/**
 * Las etapas y orígenes de un prospecto, compartidos por servidor y cliente.
 *
 * Este archivo es puro: no importa la base. El tablero y la API tienen que
 * nombrar las mismas cinco etapas y en el mismo orden, y una lista duplicada
 * acabaría enseñando una columna que la otra mitad no reconoce.
 */

export const ETAPAS_PROSPECTO = [
  "contactado",
  "visitado",
  "interesado",
  "pack_enviado",
  "pagando",
] as const;

export type EtapaProspecto = (typeof ETAPAS_PROSPECTO)[number];

export const ETAPA_LABEL: Record<EtapaProspecto, string> = {
  contactado: "Contactado",
  visitado: "Visitado",
  interesado: "Interesado",
  pack_enviado: "Pack enviado",
  pagando: "Pagando",
};

export const ORIGENES_PROSPECTO = [
  "visita_propia",
  "afiliado",
  "analytics",
] as const;

export type OrigenProspecto = (typeof ORIGENES_PROSPECTO)[number];

export const ORIGEN_LABEL: Record<OrigenProspecto, string> = {
  visita_propia: "Visita propia",
  afiliado: "Afiliado",
  analytics: "Analytics",
};

export interface ProspectoAdmin {
  id: string;
  nombre: string;
  provincia: string;
  origen: OrigenProspecto;
  origenDetalle: string | null;
  etapa: EtapaProspecto;
  proximoPaso: string;
  proximoPasoEn: string | null;
  notas: string;
  adminResponsableId: string | null;
  adminResponsableNombre: string | null;
  negocioId: string | null;
  negocioNombre: string | null;
  etapaCambiadaEn: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProspecto {
  id: string;
  nombre: string;
  email: string;
}

export function esEtapaProspecto(valor: unknown): valor is EtapaProspecto {
  return (
    typeof valor === "string" &&
    (ETAPAS_PROSPECTO as readonly string[]).includes(valor)
  );
}

export function esOrigenProspecto(valor: unknown): valor is OrigenProspecto {
  return (
    typeof valor === "string" &&
    (ORIGENES_PROSPECTO as readonly string[]).includes(valor)
  );
}

/** La etapa siguiente, o `null` si ya está en la última. */
export function siguienteEtapa(
  etapa: EtapaProspecto,
): EtapaProspecto | null {
  const indice = ETAPAS_PROSPECTO.indexOf(etapa);
  return ETAPAS_PROSPECTO[indice + 1] ?? null;
}

/** La etapa anterior, o `null` si ya está en la primera. */
export function etapaAnterior(etapa: EtapaProspecto): EtapaProspecto | null {
  const indice = ETAPAS_PROSPECTO.indexOf(etapa);
  return indice > 0 ? ETAPAS_PROSPECTO[indice - 1]! : null;
}

/** El nombre visible del origen, con su código o término cuando lo hay. */
export function textoOrigen(
  origen: OrigenProspecto,
  detalle: string | null,
): string {
  return detalle?.trim()
    ? `${ORIGEN_LABEL[origen]} · ${detalle.trim()}`
    : ORIGEN_LABEL[origen];
}
