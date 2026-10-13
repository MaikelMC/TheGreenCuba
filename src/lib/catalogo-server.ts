import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { catalogoPlanes, CATALOGO_ID } from "@/lib/db/schema/catalogo_planes";
import {
  CATALOGO,
  FUNCIONES,
  MODULOS,
  PACKS,
  PACKS_ORDER,
  funcionesDePack,
  type Catalogo,
  type ClaveModulo,
  type Funcion,
  type FuncionCatalogo,
  type ModuloCatalogo,
  type Pack,
  type PackCatalogo,
} from "@/lib/plans";

/**
 * El catálogo, del lado del servidor: leerlo de la base y **validarlo**.
 *
 * Hay dos funciones y cada una tiene un trabajo distinto. `normalizarCatalogo`
 * es la **frontera de confianza**: convierte lo que haya en la columna —o lo
 * que llegue por la API— en un `Catalogo` que cumple el tipo, campo a campo,
 * cayendo al valor de fábrica en todo lo que no valide. `cargarCatalogo` es la
 * lectura con caché.
 *
 * La separación no es decorativa: `normalizarCatalogo` es lo que garantiza que
 * un jsonb a medias —guardado por una versión anterior del panel, o escrito a
 * mano desde el editor de Neon— no pueda reventar la resolución de permisos de
 * todo el sitio. Un `usd: "gratis"` o una clave de módulo inventada se guardan,
 * sí, pero se leen como el valor por defecto.
 */

/** Etiqueta con la que se invalida el catálogo cacheado. */
export const CATALOGO_TAG = "catalogo";

/** Lo mismo que el catálogo de lugares: cinco minutos sin que nadie invalide. */
const CACHE_TTL_S = 300;

/** Tope de cualquier texto editable. Une nombre, lema y descripción. */
const MAX_TEXTO = 400;

const CLAVES_FUNCION = Object.keys(FUNCIONES) as Funcion[];
const CLAVES_MODULO = Object.keys(MODULOS) as ClaveModulo[];

/** Un texto recortado y no vacío, o el de fábrica. */
function texto(valor: unknown, porDefecto: string): string {
  if (typeof valor !== "string") return porDefecto;
  const limpio = valor.trim().slice(0, MAX_TEXTO);
  return limpio || porDefecto;
}

/** Un precio finito y no negativo, o el de fábrica. */
function precio(valor: unknown, porDefecto: number): number {
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(n) || n < 0) return porDefecto;
  return Math.round(n * 100) / 100;
}

/**
 * Una lista de claves conocidas, sin repetir.
 *
 * `null` cuando lo que llegó no es una lista —y entonces quien llama usa el
 * valor de fábrica—, pero `[]` cuando sí lo es y está vacía: **«sin funciones»
 * es una decisión válida del administrador**, no un dato que falte.
 */
function claves<T extends string>(valor: unknown, validas: readonly T[]): T[] | null {
  if (!Array.isArray(valor)) return null;
  const permitidas = new Set<string>(validas);
  return [
    ...new Set(valor.filter((x): x is T => typeof x === "string" && permitidas.has(x))),
  ];
}

/** Un objeto de la columna, o uno vacío. Nunca `null`. */
function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}

/**
 * Lo guardado, convertido en un catálogo que cumple el tipo.
 *
 * Nunca lanza: todo lo que no valide cae al valor de fábrica de **ese campo**,
 * no al catálogo entero. Así un `usd` roto no borra también los nombres, y
 * arreglar un campo no obliga a rehacer los demás.
 */
export function normalizarCatalogo(datos: unknown): Catalogo {
  const src = objeto(datos);

  const tasa = Number(src.tasaCup);
  const tasaCup = Number.isFinite(tasa) && tasa > 0 ? tasa : CATALOGO.tasaCup;

  const funciones = {} as Record<Funcion, FuncionCatalogo>;
  const fSrc = objeto(src.funciones);
  for (const clave of CLAVES_FUNCION) {
    const def = FUNCIONES[clave];
    const dado = objeto(fSrc[clave]);
    funciones[clave] = {
      texto: texto(dado.texto, def.texto),
      disponible:
        typeof dado.disponible === "boolean" ? dado.disponible : def.disponible,
    };
  }

  const modulos = {} as Record<ClaveModulo, ModuloCatalogo>;
  const mSrc = objeto(src.modulos);
  for (const clave of CLAVES_MODULO) {
    const def = MODULOS[clave];
    const dado = objeto(mSrc[clave]);
    modulos[clave] = {
      nombre: texto(dado.nombre, def.nombre),
      lema: texto(dado.lema, def.lema),
      texto: texto(dado.texto, def.texto),
      usd: precio(dado.usd, def.usd),
      funciones: claves(dado.funciones, CLAVES_FUNCION) ?? [...def.funciones],
    };
  }

  const packs = {} as Record<Pack, PackCatalogo>;
  const pSrc = objeto(src.packs);
  for (const clave of PACKS_ORDER) {
    const def = PACKS[clave];
    const dado = objeto(pSrc[clave]);
    const incluye = claves(dado.incluye, CLAVES_MODULO) ?? [...def.incluye];
    const bonos = claves(dado.bonos, CLAVES_FUNCION) ?? [...def.bonos];
    packs[clave] = {
      nombre: texto(dado.nombre, def.nombre),
      lema: texto(dado.lema, def.lema),
      texto: texto(dado.texto, def.texto),
      usd: precio(dado.usd, def.usd),
      incluye,
      bonos,
      /* Derivadas, nunca de lo guardado: es lo que impide que un pack anuncie
         funciones que sus módulos no traen. */
      funciones: funcionesDePack(incluye, bonos, modulos),
    };
  }

  return {
    tasaCup,
    gratisNombre: texto(src.gratisNombre, CATALOGO.gratisNombre),
    gratisLema: texto(src.gratisLema, CATALOGO.gratisLema),
    gratis: claves(src.gratis, CLAVES_FUNCION) ?? [...CATALOGO.gratis],
    funciones,
    modulos,
    packs,
  };
}

/** La fila guardada, normalizada. Catálogo de fábrica si no hay fila. */
async function leer(): Promise<Catalogo> {
  const [row] = await db
    .select({ datos: catalogoPlanes.datos })
    .from(catalogoPlanes)
    .where(eq(catalogoPlanes.id, CATALOGO_ID))
    .limit(1);
  return row ? normalizarCatalogo(row.datos) : CATALOGO;
}

/* Igual que el catálogo de lugares: en desarrollo no se cachea, porque aquí el
   catálogo se toca a mano y una caché de cinco minutos convertiría el cambio en
   un misterio. La caché es para producción, que es donde está el tráfico. */
const leerCacheado = unstable_cache(leer, ["catalogo-planes"], {
  tags: [CATALOGO_TAG],
  revalidate: CACHE_TTL_S,
});

/**
 * El catálogo vigente. Es lo que llama la capa servidor.
 *
 * Si la tabla está vacía o la lectura falla —Neon caído, red de esta máquina—
 * devuelve el de fábrica: un catálogo de planes que no se puede leer no puede
 * dejar el sitio sin permisos resueltos, que es peor que unos precios viejos.
 */
export async function cargarCatalogo(): Promise<Catalogo> {
  try {
    return await (process.env.NODE_ENV === "production" ? leerCacheado() : leer());
  } catch {
    return CATALOGO;
  }
}
