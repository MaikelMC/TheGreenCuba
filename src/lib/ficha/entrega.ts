/**
 * La tarjeta de domicilio: cuánto cuesta llevar el pedido, cuánto tarda y
 * cuánto hay que gastar como mínimo.
 *
 * Módulo puro: lo lee la ficha para pintar la tarjeta, el carrito para sumar el
 * envío y el panel para editarlo. El costo es una unión y no un número porque
 * «gratis», «a consultar» y «gratis a partir de 20 USD» no son cifras: son
 * frases distintas, y meterlas todas en `0` haría que la ficha enseñara «0» en
 * un negocio que cobra según la zona.
 */

import type { Horario } from "./horario";

/** Una cifra con su moneda. */
export interface Monto {
  monto: number;
  moneda: string;
}

/** Una zona de entrega con su costo. */
export interface ZonaEntrega {
  id: string;
  nombre: string;
  monto: number;
  /** Moneda de esta zona. Sobrescribe la de la lista si existe. */
  moneda: string;
  /** Tiempo aproximado de entrega en minutos. */
  tiempoMin?: number;
  activa: boolean;
}

/** Cómo se cobra (o no) el envío. */
export type CostoEntrega =
  | { modo: "gratis" }
  | { modo: "consultar" }
  | ({ modo: "fijo" } & Monto)
  | ({ modo: "gratis_desde"; desde: number } & Monto)
  | { modo: "zonas"; zonas: ZonaEntrega[]; moneda: string };

/** Configuración de pedidos programados por franja. */
export interface ProgramadosConfig {
  activo: boolean;
  /** Días por adelantado. 1 = solo mañana. Máx 7. */
  diasMax: number;
  antelacionMin: number;
  franjaMin: 30 | 60;
  /** Máximo pedidos por franja. `null` = sin límite. */
  cupoPorFranja: number | null;
  /** Minutos antes de la franja para el aviso por Telegram. */
  avisoMin: number;
}

export const PROGRAMADOS_DEFAULT: ProgramadosConfig = {
  activo: false,
  diasMax: 2,
  antelacionMin: 60,
  franjaMin: 30,
  cupoPorFranja: null,
  avisoMin: 45,
};

/** Lo que configura el negocio para el reparto. */
export interface EntregaConfig {
  costo: CostoEntrega;
  /** Rango de tiempo estimado, en minutos. `min <= max`. */
  tiempo: { min: number; max: number };
  /** Pedido mínimo para repartir. Ausente = sin mínimo. */
  pedidoMinimo?: Monto;
  /** Horario propio del reparto (= horario de cocina). Ausente = el del local. */
  horario?: Horario;
  /** Pausa manual de cocina. `hasta: null` = cerrada indefinidamente. */
  pausa?: { desde: number; hasta: number | null; motivo?: string };
  /** El cliente puede pasar a recoger en el local. */
  recogida?: boolean;
  /** El negocio hace entregas a domicilio. */
  domicilio?: boolean;
  /** Nota libre sobre el reparto ("Entregamos de 10 a. m. a 6 p. m."). */
  notaEntrega?: string;
  /** Configuración de pedidos programados por franja horaria. */
  programados?: ProgramadosConfig;
}

/**
 * Un parche de la configuración de entrega.
 *
 * Cada campo presente reemplaza al que había; `null` lo borra. Un campo
 * **ausente se queda como estaba**. Es la forma que tienen los guardados
 * parciales —zonas, pausa, horario de cocina, programados— de no borrar lo que
 * no tocan: la columna es un `jsonb` y hasta ahora cada uno escribía el objeto
 * entero, así que guardar zonas se llevaba por delante la pausa.
 */
export type ParcheEntrega = {
  [K in keyof EntregaConfig]?: EntregaConfig[K] | null;
};

/**
 * Fusiona un guardado parcial con la configuración que ya había.
 *
 * Solo se reemplazan las claves que llegan en `parche`. `null` borra esa clave
 * —es la forma de quitar una pausa o un pedido mínimo—, y `undefined` o una
 * clave ausente no toca nada. `parche` nulo o indefinido devuelve lo actual:
 * un guardado que no trae entrega no puede vaciarla.
 *
 * Es una fusión superficial a propósito: cada campo (`costo`, `tiempo`,
 * `horario`, `pausa`, `programados`…) es un valor completo que se reemplaza
 * como una unidad. Lo que no venga, se conserva.
 */
export function fusionarEntrega(
  actual: EntregaConfig | null | undefined,
  parche: ParcheEntrega | null | undefined,
): EntregaConfig | null {
  if (!parche) return actual ?? null;

  const base: EntregaConfig =
    actual ?? { costo: { modo: "consultar" }, tiempo: { min: 0, max: 0 } };
  const { poner, borrar } = dividirParcheEntrega(parche);

  const salida: Record<string, unknown> = { ...base, ...poner };
  for (const clave of borrar) delete salida[clave];
  return salida as unknown as EntregaConfig;
}

/**
 * Separa un parche en lo que se escribe y lo que se borra.
 *
 * `null` significa «quita esta clave», no «guarda un null»: en el `jsonb` una
 * clave con `null` se lee como un valor y no como ausencia, y el tipo no la
 * admite. Lo usan la fusión pura y la escritura atómica de servidor para que
 * las dos traten igual el borrado.
 */
export function dividirParcheEntrega(parche: ParcheEntrega): {
  poner: Partial<EntregaConfig>;
  borrar: (keyof EntregaConfig)[];
} {
  const poner: Record<string, unknown> = {};
  const borrar: (keyof EntregaConfig)[] = [];
  for (const [clave, valor] of Object.entries(parche)) {
    if (valor === undefined) continue;
    if (valor === null) borrar.push(clave as keyof EntregaConfig);
    else poner[clave] = valor;
  }
  return { poner: poner as Partial<EntregaConfig>, borrar };
}

function esMonto(value: unknown): value is Monto {
  if (!value || typeof value !== "object") return false;
  const m = value as Partial<Monto>;
  return (
    typeof m.monto === "number" &&
    Number.isFinite(m.monto) &&
    m.monto >= 0 &&
    typeof m.moneda === "string" &&
    m.moneda.trim().length > 0
  );
}

function esCostoEntrega(value: unknown): value is CostoEntrega {
  if (!value || typeof value !== "object") return false;
  const costo = value as Partial<CostoEntrega> & {
    modo?: unknown;
    desde?: unknown;
    zonas?: unknown;
    moneda?: unknown;
  };
  switch (costo.modo) {
    case "gratis":
    case "consultar":
      return true;
    case "fijo":
      return esMonto(costo);
    case "gratis_desde": {
      if (!esMonto(costo)) return false;
      const desde = (costo as Monto & { desde?: unknown }).desde;
      return (
        typeof desde === "number" && Number.isFinite(desde) && desde >= 0
      );
    }
    case "zonas": {
      if (typeof costo.moneda !== "string" || !costo.moneda.trim()) return false;
      if (!Array.isArray(costo.zonas)) return false;
      if (costo.zonas.length > 40) return false;
      if (
        !costo.zonas.every(
          (z) =>
            z &&
            typeof z.id === "string" &&
            z.id.trim().length > 0 &&
            typeof z.nombre === "string" &&
            z.nombre.trim().length > 0 &&
            z.nombre.trim().length <= 60 &&
            typeof z.monto === "number" &&
            Number.isFinite(z.monto) &&
            z.monto >= 0 &&
            typeof z.moneda === "string" &&
            z.moneda.trim().length > 0 &&
            typeof z.activa === "boolean" &&
            (z.tiempoMin === undefined ||
              (typeof z.tiempoMin === "number" && z.tiempoMin >= 0)),
        )
      ) {
        return false;
      }
      const ids = (costo.zonas as ZonaEntrega[]).map((z) => z.id);
      return new Set(ids).size === ids.length;
    }
    default:
      return false;
  }
}

function esTiempoEntrega(value: unknown): value is EntregaConfig["tiempo"] {
  if (!value || typeof value !== "object") return false;
  const tiempo = value as Partial<EntregaConfig["tiempo"]>;
  return (
    typeof tiempo.min === "number" &&
    typeof tiempo.max === "number" &&
    Number.isFinite(tiempo.min) &&
    Number.isFinite(tiempo.max) &&
    tiempo.min >= 0 &&
    tiempo.min <= tiempo.max
  );
}

function esPausa(value: unknown): value is NonNullable<EntregaConfig["pausa"]> {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<{ desde: number; hasta: number | null; motivo: string }>;
  if (typeof p.desde !== "number" || !Number.isFinite(p.desde)) return false;
  if (p.hasta !== null && (typeof p.hasta !== "number" || !Number.isFinite(p.hasta))) {
    return false;
  }
  if (p.motivo !== undefined && typeof p.motivo !== "string") return false;
  return true;
}

function esProgramados(value: unknown): value is ProgramadosConfig {
  if (!value || typeof value !== "object") return false;
  const pg = value as Partial<ProgramadosConfig>;
  if (typeof pg.activo !== "boolean") return false;
  if (typeof pg.diasMax !== "number" || pg.diasMax < 1 || pg.diasMax > 7) return false;
  if (typeof pg.antelacionMin !== "number" || pg.antelacionMin < 0) return false;
  if (pg.franjaMin !== 30 && pg.franjaMin !== 60) return false;
  if (pg.cupoPorFranja !== null) {
    if (typeof pg.cupoPorFranja !== "number" || pg.cupoPorFranja < 1) return false;
  }
  if (typeof pg.avisoMin !== "number" || pg.avisoMin < 0) return false;
  return true;
}

const CLAVES_ENTREGA: ReadonlySet<string> = new Set<keyof EntregaConfig>([
  "costo",
  "tiempo",
  "pedidoMinimo",
  "horario",
  "pausa",
  "recogida",
  "domicilio",
  "notaEntrega",
  "programados",
]);

/**
 * Valida un guardado parcial **clave por clave** antes de fusionarlo.
 *
 * Rechaza claves que no existen en `EntregaConfig`: un cuerpo con un campo
 * inventado no debe llegar a la columna. `null` se acepta solo en los campos
 * opcionales, como orden de borrar; `costo` y `tiempo` son obligatorios y no
 * se pueden anular.
 */
export function esParcheEntrega(value: unknown): value is ParcheEntrega {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;

  for (const clave of Object.keys(p)) {
    if (!CLAVES_ENTREGA.has(clave)) return false;
  }

  if (p.costo !== undefined && !esCostoEntrega(p.costo)) return false;
  if (p.tiempo !== undefined && !esTiempoEntrega(p.tiempo)) return false;
  if (
    p.pedidoMinimo !== undefined &&
    p.pedidoMinimo !== null &&
    !esMonto(p.pedidoMinimo)
  ) {
    return false;
  }
  if (
    p.horario !== undefined &&
    p.horario !== null &&
    (typeof p.horario !== "object" || Array.isArray(p.horario))
  ) {
    return false;
  }
  if (p.pausa !== undefined && p.pausa !== null && !esPausa(p.pausa)) return false;
  if (p.recogida !== undefined && typeof p.recogida !== "boolean") return false;
  if (p.domicilio !== undefined && typeof p.domicilio !== "boolean") return false;
  if (p.notaEntrega !== undefined && typeof p.notaEntrega !== "string") return false;
  if (p.programados !== undefined && p.programados !== null && !esProgramados(p.programados)) {
    return false;
  }
  return true;
}

/**
 * Valida una configuración completa antes de guardarla.
 *
 * Rechaza en vez de corregir: un envío negativo o un rango con `min > max` es
 * un error del formulario, y arreglarlo en silencio dejaría una tarjeta que
 * dice algo que el dueño no configuró.
 */
export function esEntregaConfig(value: unknown): value is EntregaConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const e = value as Partial<EntregaConfig>;

  if (!esCostoEntrega(e.costo)) return false;
  if (!esTiempoEntrega(e.tiempo)) return false;

  if (e.pedidoMinimo !== undefined && !esMonto(e.pedidoMinimo)) return false;
  /* El horario del reparto se valida en `horario.ts`; aquí solo se comprueba
     que, si viene, sea un objeto. Evitar el import circular no vale la pena:
     quien guarda llama a las dos validaciones. */
  if (e.horario !== undefined && (typeof e.horario !== "object" || e.horario === null)) {
    return false;
  }
  if (e.pausa !== undefined && !esPausa(e.pausa)) return false;
  if (e.recogida !== undefined && typeof e.recogida !== "boolean") return false;
  if (e.domicilio !== undefined && typeof e.domicilio !== "boolean") return false;
  if (e.notaEntrega !== undefined && typeof e.notaEntrega !== "string") return false;
  if (e.programados !== undefined && !esProgramados(e.programados)) return false;
  return true;
}

/**
 * El costo del envío para un pedido concreto, o `null` si hay que consultarlo.
 *
 * `subtotal` decide los modos que dependen del pedido (`gratis_desde`). En
 * `zonas` el llamador pasa el monto de la zona elegida y aquí no se adivina.
 */
export function costoEnvio(
  costo: CostoEntrega,
  subtotal: number,
): number | null {
  switch (costo.modo) {
    case "gratis":
      return 0;
    case "consultar":
      return null;
    case "fijo":
      return costo.monto;
    case "gratis_desde":
      return subtotal >= costo.desde ? 0 : costo.monto;
    case "zonas":
      return null;
  }
}
