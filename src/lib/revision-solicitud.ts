/**
 * La revisión automática de una solicitud de negocio.
 *
 * Una sola función pura, para que la bandeja de Pendientes (Fase 2) y la
 * sección de Solicitudes (Fase 6) digan exactamente lo mismo. Si la regla
 * viviera dos veces, un negocio podría salir «completo» en una pantalla y
 * «falta el tipo» en la otra.
 *
 * No consulta la base: recibe lo que ya se leyó. El teléfono duplicado y el
 * mismo dueño los resuelve quien llama, que es quien puede cruzar negocios.
 */
export interface DatosRevisionSolicitud {
  /** Cuántas fotos tiene la ficha. */
  fotos: number;
  /** Horario estructurado o `hoursJson` con algún día. */
  tieneHorario: boolean;
  /** Coordenadas dentro de Cuba. */
  ubicacionValida: boolean;
  /** `places.tipo_negocio`. */
  tipo: string | null;
  /** Otro negocio ya usa este mismo teléfono. */
  telefonoDuplicado: boolean;
}

export interface RevisionSolicitud {
  fotos: boolean;
  horario: boolean;
  ubicacion: boolean;
  tipo: boolean;
  telefonoDuplicado: boolean;
  /** Todo lo que hace falta para aprobar sin abrir la ficha. */
  completa: boolean;
  /** Frases cortas de lo que falta, en el orden en que se arregla. */
  faltan: string[];
}

export function revisarSolicitud(
  datos: DatosRevisionSolicitud,
): RevisionSolicitud {
  const fotos = datos.fotos > 0;
  const horario = datos.tieneHorario;
  const ubicacion = datos.ubicacionValida;
  const tipo = Boolean(datos.tipo?.trim());
  const telefonoDuplicado = datos.telefonoDuplicado;

  const faltan: string[] = [];
  if (!tipo) faltan.push("Sin tipo de negocio");
  if (!fotos) faltan.push("Sin fotos");
  if (!horario) faltan.push("Sin horario");
  if (!ubicacion) faltan.push("Sin ubicación válida");
  if (telefonoDuplicado) faltan.push("Teléfono repetido en otro negocio");

  return {
    fotos,
    horario,
    ubicacion,
    tipo,
    telefonoDuplicado,
    completa: fotos && horario && ubicacion && tipo && !telefonoDuplicado,
    faltan,
  };
}
