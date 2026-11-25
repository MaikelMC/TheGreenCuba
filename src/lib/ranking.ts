/**
 * El ranking mensual, en su parte **pura**: fechas del periodo, la regla del
 * top 3 por grupo y el umbral anti-fraude.
 *
 * Módulo sin base de datos a propósito —lo mismo que `ofertas.ts` y
 * `publicaciones.ts`—, para poder probar las tres reglas que deciden quién gana
 * sin levantar la base. Quien escribe y lee las filas es `ranking-server.ts`.
 *
 * La métrica es **visitas únicas** (`eventos_diarios.unicos` de `TIPOS_VISTA`:
 * abrir la ficha o la carta): no clics, no páginas vistas —cuánta gente distinta
 * vio ese negocio ese mes—. Las visitas del propio dueño ya no llegan aquí: el beacon de
 * `api/negocio/evento` las descarta al entrar (`esDueno`), así que no hay nada
 * que excluir al calcular.
 */

/** Cuántos puestos guarda cada grupo: el podio entero, ni uno más. */
export const TOP = 3;

/**
 * Descuento que se concede a quien sale en el top, en tanto por ciento.
 *
 * Es una constante, no una columna de configuración: el premio es el mismo para
 * todos los meses y para todos los grupos, y un número que nadie cambia no
 * merece una tabla.
 */
export const DESCUENTO_PCT = 20;

/**
 * A partir de qué porcentaje de las visitas de un negocio vienen del **mismo
 * visitante** se considera inflado.
 *
 * Estricto con `>`: justo el 40% pasa, más del 40% no. Un negocio con cuatro
 * visitantes únicos donde uno repite no es un fraude; uno donde la mitad de las
 * visitas son de la misma cookie, sí.
 */
export const MAX_PCT_MISMO_VISITANTE = 40;

/** El periodo «YYYY-MM» de una fecha, en UTC (el mismo huso que `fecha`). */
export function periodoDe(fecha: Date = new Date()): string {
  return fecha.toISOString().slice(0, 7);
}

/**
 * El mes **anterior** al de `fecha`, que es el que cierra el job.
 *
 * El trabajo corre al empezar el mes, cuando el que acaba de terminar ya tiene
 * todos sus días escritos: calcular el mes en curso a mitad de mes daría un top
 * a medias que luego cambiaría.
 */
export function periodoAnterior(fecha: Date = new Date()): string {
  const d = new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() - 1, 1),
  );
  return periodoDe(d);
}

/** ¿Tiene forma de periodo? Sirve para validar el `?periodo=` de la ruta. */
export function esPeriodo(valor: unknown): valor is string {
  return typeof valor === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor);
}

/**
 * El primer y el último día del periodo, como «YYYY-MM-DD».
 *
 * El último día se saca del **día 0 del mes siguiente**, que es como `Date`
 * resuelve solo la longitud del mes: 31, 30 o 28/29 sin una tabla de días ni un
 * caso especial para febrero.
 */
export function rangoPeriodo(periodo: string): { desde: string; hasta: string } {
  /* Los valores por defecto son para el compilador, no para el cálculo: quien
     llama ya pasó por `esPeriodo`, que garantiza las dos partes. */
  const [anio = 0, mes = 1] = periodo.split("-").map(Number);
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return {
    desde: `${periodo}-01`,
    hasta: `${periodo}-${String(ultimo).padStart(2, "0")}`,
  };
}

/**
 * ¿Huele a inflado? Recibe las visitas de cada visitante distinto del negocio y
 * dice si uno solo acapara más del umbral.
 *
 * **Ceiling conocido.** El `visitante` de `eventos_unicos` es un hash que
 * incluye **el día** (`visitanteDe` en la ruta del beacon), así que una misma
 * persona repartida por el mes llega con un hash distinto cada día y no se
 * reconoce. Lo que esto caza de verdad es a quien dispara muchas visitas
 * **dentro de un mismo día** con la misma cookie —un bucle, una pestaña
 * refrescada—, que es el fraude barato. Subir la valla a fraude lento —una
 * visita al día durante treinta días— pediría guardar un hash **estable** por
 * negocio, y eso es justo lo que el diseño de eventos evita para no retener a
 * nadie. Se acepta mientras no aparezca el abuso; `ponytail:` si aparece.
 */
export function pareceFraude(visitasPorVisitante: number[]): boolean {
  let total = 0;
  let max = 0;
  for (const n of visitasPorVisitante) {
    total += n;
    if (n > max) max = n;
  }
  if (total === 0) return false;
  return (max / total) * 100 > MAX_PCT_MISMO_VISITANTE;
}

/** Un negocio que compite: sus visitas únicas y el grupo al que pertenece. */
export interface CandidatoRanking {
  negocioId: string;
  /** Slug de la categoría. */
  categoria: string;
  municipio: string;
  visitas: number;
}

/** Un candidato ya colocado en su puesto del podio. */
export interface PuestoRanking extends CandidatoRanking {
  posicion: number;
}

/**
 * Reparte los candidatos en su grupo —categoría + municipio— y deja los tres
 * primeros de cada uno.
 *
 * El desempate es por `negocioId` y no por el orden en que llegaron las filas:
 * sin él, dos negocios con las mismas visitas bailarían de puesto entre dos
 * ejecuciones del job y el descuento dependería de cómo devolvió Postgres las
 * filas esa vez. Cualquier orden **estable** vale; este es el que hay.
 *
 * Los grupos son la clave compuesta, no dos listas por separado: un negocio
 * compite contra los de **su** categoría en **su** municipio, no contra todos.
 */
export function topPorGrupo(candidatos: CandidatoRanking[]): PuestoRanking[] {
  const grupos = new Map<string, CandidatoRanking[]>();

  for (const c of candidatos) {
    if (c.visitas <= 0) continue;
    const clave = `${c.categoria}\u0000${c.municipio}`;
    const lista = grupos.get(clave);
    if (lista) lista.push(c);
    else grupos.set(clave, [c]);
  }

  const puestos: PuestoRanking[] = [];
  for (const lista of grupos.values()) {
    lista.sort(
      (a, b) => b.visitas - a.visitas || a.negocioId.localeCompare(b.negocioId),
    );
    lista.slice(0, TOP).forEach((c, i) => {
      puestos.push({ ...c, posicion: i + 1 });
    });
  }

  return puestos;
}
