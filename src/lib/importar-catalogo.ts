/**
 * Importación de catálogo por CSV — parseo y validación.
 *
 * Es **puro** y sin `"use client"`, y esa es la decisión de diseño: el mismo
 * módulo lo usan el servidor (la ruta de administración) y el navegador (la
 * pantalla, que revalida cada fila al editarla sin volver a pedir nada). Si la
 * validación viviera solo en la ruta, corregir un error en la vista previa
 * obligaría a un viaje al servidor por cada tecla.
 *
 * No hay dependencia nueva: el parser de CSV son unas treinta líneas aquí
 * abajo. La alternativa —traer una librería— resolvía de más (streaming, tipos
 * por columna, dialectos) para un archivo que se lee entero en memoria y cabe
 * en 1 MB.
 *
 * La carta del negocio **no es una tabla**: vive en el jsonb `places.menu`
 * (ver `UserPlaceMenuItem`). Por eso aquí no hay «insertar fila» ni
 * `importacion_id` como columna: la marca de la importación viaja dentro de
 * cada producto del jsonb, y deshacerla es reescribir el array sin ellos.
 */

export const MAX_FILAS = 500;
export const MAX_BYTES = 1024 * 1024;

/** Las monedas soportadas, las mismas que el editor de la carta. */
export const MONEDAS = ["MLC", "CUP", "USD", "EUR"] as const;
export const MONEDA_POR_DEFECTO = "CUP";

export const LIMITES_CAMPO = {
  nombre: 80,
  categoria: 40,
  descripcion: 300,
} as const;

export type EstadoFila = "nuevo" | "duplicado" | "error";

/** Una fila del CSV con sus campos tal cual, sin estado todavía. */
export interface FilaCruda {
  /** Número de línea en el archivo, contando la cabecera. Solo para señalar. */
  numero: number;
  nombre: string;
  categoria: string;
  descripcion: string;
  precio: string;
  moneda: string;
}

export interface FilaValidada extends FilaCruda {
  estado: EstadoFila;
  motivo?: string;
}

/** Lo mínimo de un producto ya existente para detectar duplicados. */
export interface ProductoExistente {
  nombre: string;
  categoria?: string;
}

export interface Resumen {
  nuevos: number;
  duplicados: number;
  errores: number;
}

/**
 * Clave de comparación: sin mayúsculas, sin tildes y sin espacios de sobra.
 *
 * Es la misma normalización para detectar duplicados, para reaprovechar la
 * grafía de una categoría que ya existe y para decidir si dos categorías del
 * archivo son la misma. Una sola definición evita que las tres se desincronicen.
 */
export function clave(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * El separador del archivo: el que más aparece en la primera línea **fuera de
 * las comillas**. Contar sin mirar las comillas se equivoca con una cabecera
 * como `nombre,descripcion` si la descripción de ejemplo trae punto y coma, así
 * que se recorre respetando los tramos entrecomillados.
 */
function detectarDelimitador(linea: string): "," | ";" {
  let comas = 0;
  let puntos = 0;
  let enComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i] ?? "";
    if (c === '"') {
      if (enComillas && linea[i + 1] === '"') {
        i++;
        continue;
      }
      enComillas = !enComillas;
    } else if (!enComillas) {
      if (c === ",") comas++;
      else if (c === ";") puntos++;
    }
  }

  return puntos > comas ? ";" : ",";
}

/**
 * CSV a matriz de celdas. Tolera el BOM, los saltos `\r\n` y los campos
 * entrecomillados con comillas dobles escapadas (`""`).
 *
 * Un salto de línea dentro de comillas **no** corta la fila: el bucle solo
 * trata el `\n` como fin de fila cuando no está dentro de un campo citado.
 */
export function parseCsv(texto: string): string[][] {
  const t = texto.replace(/^\uFEFF/, "");
  const primeraLinea = t.split(/\r?\n/, 1)[0] ?? "";
  const delim = detectarDelimitador(primeraLinea);

  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let enComillas = false;

  for (let i = 0; i < t.length; i++) {
    const c = t[i] ?? "";

    if (enComillas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === delim) {
      fila.push(campo);
      campo = "";
    } else if (c === "\n") {
      fila.push(campo);
      campo = "";
      filas.push(fila);
      fila = [];
    } else if (c !== "\r") {
      campo += c;
    }
  }

  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  /* Fuera las filas en blanco: un CSV que termina en salto de línea deja una
     última fila vacía, y contarla como error de «falta el nombre» acusaría a un
     archivo perfecto. */
  return filas.filter((f) => f.some((c) => c.trim() !== ""));
}

/** Alias aceptados por columna. Las claves van ya normalizadas con `clave()`. */
const ALIAS: Record<string, keyof FilaCruda> = {
  nombre: "nombre",
  name: "nombre",
  producto: "nombre",
  articulo: "nombre",
  servicio: "nombre",
  categoria: "categoria",
  category: "categoria",
  familia: "categoria",
  grupo: "categoria",
  descripcion: "descripcion",
  description: "descripcion",
  detalle: "descripcion",
  precio: "precio",
  price: "precio",
  moneda: "moneda",
  currency: "moneda",
};

/** Dónde cae cada campo en la cabecera. Lo que no se reconoce se ignora. */
export function columnas(
  cabecera: string[],
): Partial<Record<keyof FilaCruda, number>> {
  const mapa: Partial<Record<keyof FilaCruda, number>> = {};
  cabecera.forEach((titulo, i) => {
    const campo = ALIAS[clave(titulo)];
    if (campo && mapa[campo] === undefined) mapa[campo] = i;
  });
  return mapa;
}

/**
 * El texto entero a filas crudas. Devuelve `error` —y ninguna fila— cuando el
 * archivo no sirve de entrada: vacío, sin columna de nombre, o pasado de tope.
 * Los fallos de una fila concreta **no** están aquí, sino en `validarFilas`:
 * así la vista previa puede enseñarlos uno a uno en vez de tirar el archivo.
 */
export function parsearCatalogo(texto: string): {
  filas: FilaCruda[];
  error?: string;
} {
  if (new TextEncoder().encode(texto).length > MAX_BYTES) {
    return { filas: [], error: "El archivo pasa de 1 MB. Divídelo." };
  }

  const matriz = parseCsv(texto);
  if (matriz.length === 0) {
    return { filas: [], error: "El CSV está vacío." };
  }

  const cols = columnas(matriz[0] ?? []);
  if (cols.nombre === undefined) {
    return {
      filas: [],
      error: "No encuentro la columna «nombre». La cabecera tiene que llamarla así.",
    };
  }

  const cuerpo = matriz.slice(1);
  if (cuerpo.length > MAX_FILAS) {
    return {
      filas: [],
      error: `El CSV trae ${cuerpo.length} filas y el máximo por importación es ${MAX_FILAS}.`,
    };
  }

  const celda = (fila: string[], campo: keyof FilaCruda): string => {
    const i = cols[campo];
    return i === undefined ? "" : (fila[i] ?? "").trim();
  };

  return {
    filas: cuerpo.map((fila, i) => ({
      numero: i + 2,
      nombre: celda(fila, "nombre"),
      categoria: celda(fila, "categoria"),
      descripcion: celda(fila, "descripcion"),
      precio: celda(fila, "precio"),
      moneda: celda(fila, "moneda"),
    })),
  };
}

/**
 * El precio como número, o `null` si no lo es. Acepta coma o punto decimal
 * —en Cuba se escribe «12,50»— y rechaza cualquier símbolo, incluido el de la
 * moneda: «$12» no es un precio, es un precio mal copiado.
 */
export function precioNumerico(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(limpio)) return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** El precio tal como se guarda en la carta: con punto, sin ceros de relleno. */
export function textoPrecio(texto: string): string {
  const n = precioNumerico(texto);
  return n === null ? texto.trim() : String(n);
}

/**
 * Valida cada fila y le pone estado.
 *
 * El orden importa: primero los campos, y solo una fila con los campos en regla
 * entra en el reparto de duplicados. Al revés, una fila sin nombre chocaría con
 * cualquier otra sin nombre y las dos saldrían marcadas por duplicado, que no es
 * el problema que tienen.
 *
 * Los duplicados se detectan contra los productos que ya hay **y** entre las
 * propias filas, en orden: la segunda «Agua / Bebidas» del archivo es la
 * duplicada, no la primera. Se comparan por nombre y categoría sin tildes ni
 * mayúsculas; la categoría del archivo adopta la grafía que ya usa el negocio
 * («bebidas» → «Bebidas») para no acabar con dos grupos que son el mismo.
 */
export function validarFilas(
  filas: FilaCruda[],
  existentes: ProductoExistente[],
): FilaValidada[] {
  /* Grafía canónica por categoría: la primera que se ve gana. Se siembra con las
     que ya usa el negocio y se amplía con las nuevas del archivo. */
  const canonicas = new Map<string, string>();
  const vistos = new Set<string>();

  for (const p of existentes) {
    const categoria = p.categoria?.trim();
    if (categoria) canonicas.set(clave(categoria), categoria);
    const nombre = p.nombre?.trim();
    if (nombre) vistos.add(`${clave(nombre)}|${clave(p.categoria ?? "")}`);
  }

  return filas.map((fila): FilaValidada => {
    const nombre = fila.nombre.trim();
    const categoriaCruda = fila.categoria.trim();
    const descripcion = fila.descripcion.trim();
    const base = { ...fila, nombre, descripcion };
    const error = (motivo: string): FilaValidada => ({
      ...base,
      categoria: categoriaCruda,
      estado: "error",
      motivo,
    });

    if (!nombre) return error("Falta el nombre.");
    if (nombre.length > LIMITES_CAMPO.nombre) {
      return error(`El nombre pasa de ${LIMITES_CAMPO.nombre} caracteres.`);
    }
    if (!categoriaCruda) return error("Falta la categoría.");
    if (categoriaCruda.length > LIMITES_CAMPO.categoria) {
      return error(`La categoría pasa de ${LIMITES_CAMPO.categoria} caracteres.`);
    }
    if (descripcion.length > LIMITES_CAMPO.descripcion) {
      return error(`La descripción pasa de ${LIMITES_CAMPO.descripcion} caracteres.`);
    }
    if (precioNumerico(fila.precio) === null) {
      return error("El precio tiene que ser un número de 0 o más, sin símbolos.");
    }

    const moneda = (fila.moneda.trim() || MONEDA_POR_DEFECTO).toUpperCase();
    if (!(MONEDAS as readonly string[]).includes(moneda)) {
      return error(`La moneda «${fila.moneda}» no está soportada (${MONEDAS.join(", ")}).`);
    }

    const categoria = canonicas.get(clave(categoriaCruda)) ?? categoriaCruda;
    if (!canonicas.has(clave(categoriaCruda))) {
      canonicas.set(clave(categoriaCruda), categoriaCruda);
    }

    const marca = `${clave(nombre)}|${clave(categoria)}`;
    if (vistos.has(marca)) {
      return {
        ...base,
        categoria,
        moneda,
        estado: "duplicado",
        motivo: "Ya hay un producto con ese nombre y categoría.",
      };
    }
    vistos.add(marca);

    return { ...base, categoria, moneda, estado: "nuevo" };
  });
}

export function resumir(filas: FilaValidada[]): Resumen {
  return {
    nuevos: filas.filter((f) => f.estado === "nuevo").length,
    duplicados: filas.filter((f) => f.estado === "duplicado").length,
    errores: filas.filter((f) => f.estado === "error").length,
  };
}

/** Cabecera y dos ejemplos, para el botón «Descargar plantilla». */
export const PLANTILLA_CSV = [
  "nombre,categoria,descripcion,precio,moneda",
  "Ropa vieja,Entrantes,Carne deshilachada con sofrito y arroz,850,CUP",
  'Mojito de la casa,Bebidas,"Ron, hierbabuena, lima y soda",5,USD',
].join("\n");
