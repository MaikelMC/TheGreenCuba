/**
 * Completitud de la ficha de un negocio.
 *
 * Módulo puro: no toca React ni la base. Lo lee el dashboard para mostrar el
 * porcentaje y lo que falta, y el editor para dar sugerencias en contexto.
 *
 * El porcentaje es una media ponderada de secciones —portada, descripción,
 * contacto, etc.— para que un negocio sin fotos no llegue al 100% solo por
 * tener el teléfono. El peso refleja cuánto impacta cada sección en la
 * conversión: las fotos son lo primero que ve el visitante y el catálogo es
 * la razón por la que vuelve.
 *
 * No se puntúa la valoración ni nada que el negocio no controle.
 */

export interface ResultadoCompletitud {
  /** 0–100, redondeado al entero más cercano. */
  porcentaje: number;
  /** Las sugerencias más importantes, ordenadas por impacto. Máximo 5. */
  sugerencias: string[];
}

interface EntradaCompletitud {
  logoUrl?: string | null;
  /** Fotos subidas. */
  fotos: number;
  description?: string | null;
  shortDescription?: string | null;
  horario: boolean;
  phone?: string | null;
  whatsapp?: string | null;
  payments: string[];
  menu: number;
  modulosActivos: string[];
  entregaConfigurada: boolean;
  atributos: string[];
}

interface Seccion {
  nombre: string;
  peso: number;
  valor: number; // 0–1
  sugerencia?: string;
}

export function calcularCompletitud(e: EntradaCompletitud): ResultadoCompletitud {
  const secciones: Seccion[] = [
    {
      nombre: "Fotos",
      peso: 25,
      valor: e.fotos === 0 ? 0 : e.fotos < 3 ? 0.5 : 1,
      sugerencia:
        e.fotos === 0
          ? "Sube al menos 3 fotos del negocio"
          : e.fotos < 3
            ? "Sube más fotos (tienes menos de 3)"
            : undefined,
    },
    {
      nombre: "Logo",
      peso: 10,
      valor: e.logoUrl ? 1 : 0,
      sugerencia: e.logoUrl ? undefined : "Añade el logo de tu negocio",
    },
    {
      nombre: "Descripción",
      peso: 15,
      valor:
        (e.description?.trim().length ?? 0) === 0
          ? 0
          : (e.shortDescription?.trim().length ?? 0) > 0
            ? 1
            : 0.6,
      sugerencia:
        (e.description?.trim().length ?? 0) === 0
          ? "Escribe una descripción de tu negocio"
          : (e.shortDescription?.trim().length ?? 0) === 0
            ? "Añade un subtítulo corto (visible en la cabecera)"
            : undefined,
    },
    {
      nombre: "Horario",
      peso: 10,
      valor: e.horario ? 1 : 0,
      sugerencia: e.horario ? undefined : "Configura el horario por día",
    },
    {
      nombre: "Contacto",
      peso: 10,
      valor:
        e.phone || e.whatsapp
          ? e.phone && e.whatsapp
            ? 1
            : 0.6
          : 0,
      sugerencia:
        !e.phone && !e.whatsapp
          ? "Añade teléfono o WhatsApp"
          : !e.phone
            ? "Añade el número de teléfono"
            : !e.whatsapp
              ? "Añade el número de WhatsApp"
              : undefined,
    },
    {
      nombre: "Pagos",
      peso: 5,
      valor: e.payments.length > 0 ? 1 : 0,
      sugerencia:
        e.payments.length === 0 ? "Indica los métodos de pago que aceptas" : undefined,
    },
    {
      nombre: "Catálogo",
      peso: 15,
      valor: e.menu === 0 ? 0 : e.menu < 3 ? 0.5 : 1,
      sugerencia:
        e.menu === 0
          ? "Añade productos o servicios al catálogo"
          : e.menu < 3
            ? "Añade más productos al catálogo (tienes menos de 3)"
            : undefined,
    },
    {
      nombre: "Módulos",
      peso: 5,
      valor: e.modulosActivos.length > 0 ? 1 : 0,
      sugerencia:
        e.modulosActivos.length === 0
          ? "Activa al menos un bloque de la ficha (domicilio, local…)"
          : undefined,
    },
    {
      nombre: "Módulo configurado",
      peso: 5,
      valor:
        e.modulosActivos.length === 0
          ? 0
          : e.entregaConfigurada || e.modulosActivos.some((m) => m !== "domicilio")
            ? 1
            : 0.5,
      sugerencia:
        e.modulosActivos.includes("domicilio") && !e.entregaConfigurada
          ? "Configura el costo y tiempo de entrega del domicilio"
          : undefined,
    },
    {
      nombre: "Atributos",
      peso: 0, // no penaliza, solo sugiere
      valor: e.atributos.length > 0 ? 1 : 0,
      sugerencia:
        e.atributos.length === 0
          ? "Marca qué tiene tu negocio (WiFi, terraza, etc.)"
          : undefined,
    },
  ];

  const total = secciones.reduce((sum, s) => sum + s.peso, 0);
  const obtenido = secciones.reduce((sum, s) => sum + s.peso * s.valor, 0);
  const porcentaje = total === 0 ? 0 : Math.round((obtenido / total) * 100);

  const sugerencias = secciones
    .filter((s) => s.sugerencia && s.valor < 1)
    .sort((a, b) => b.peso * (1 - b.valor) - a.peso * (1 - a.valor))
    .slice(0, 5)
    .map((s) => s.sugerencia!);

  return { porcentaje, sugerencias };
}
