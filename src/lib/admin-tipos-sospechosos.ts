/**
 * Detector de fichas cuya categoría no encaja con su nombre o su carta.
 *
 * **No cambia nada.** Devuelve una lista para que una persona la revise desde
 * el panel de administración. Un negocio puede llamarse «Café» y ser un
 * restaurante; por eso la lista es de sospechosos, no de errores.
 *
 * Vive fuera de React y de la base para poder probarlo con casos reales:
 * «PQTT? Pizzería» en Cafetería, una barbería en Restaurante, una tienda de
 * aseo en Cafetería.
 */

export interface LugarParaRevisar {
  id: string;
  name: string;
  category: string;
  /** Nombres de los productos visibles de su carta. */
  productos?: readonly string[];
}

export interface SospechaTipo {
  id: string;
  name: string;
  category: string;
  /** Categoría que sugiere el nombre o la carta. */
  sugerida: string;
  /** Por qué se sospecha, en una frase para el admin. */
  motivo: string;
  /** Hasta tres coincidencias que lo justifican. */
  coincidencias: string[];
  /** 2 = el nombre lo dice; 1 = solo lo dicen los productos. */
  confianza: number;
}

interface Regla {
  categoria: string;
  palabras: readonly string[];
  /** Categorías en las que el negocio no desentona aunque use la palabra. */
  compatibles?: readonly string[];
}

/* Las palabras van sin tildes y en minúsculas; el texto se normaliza antes. */
const REGLAS: readonly Regla[] = [
  {
    categoria: "Restaurante",
    palabras: [
      "pizza",
      "pizzeria",
      "pizzas",
      "restaurante",
      "paladar",
      "parrilla",
      "sushi",
      "hamburguesa",
      "hamburguesas",
      "taco",
      "tacos",
      "comida criolla",
    ],
    compatibles: ["Bar", "Mercado", "Comida a domicilio"],
  },
  {
    categoria: "Cafetería",
    palabras: ["cafeteria", "cafe", "desayuno", "desayunos", "merienda", "meriendas"],
    compatibles: ["Restaurante", "Bar", "Mercado"],
  },
  {
    categoria: "Bar",
    palabras: ["bar", "cerveza", "cervezas", "coctel", "cocteles", "trago", "tragos"],
    compatibles: ["Restaurante", "Cafetería", "Vida nocturna"],
  },
  {
    categoria: "Vida nocturna",
    palabras: ["discoteca", "club nocturno", "karaoke", "fiesta", "noche"],
    compatibles: ["Bar"],
  },
  {
    categoria: "Tienda",
    palabras: [
      "tienda",
      "boutique",
      "ropa",
      "calzado",
      "ferreteria",
      "materiales",
      "aseo",
      "viveres",
      "mipyme",
      "market",
    ],
    compatibles: ["Mercado"],
  },
  {
    categoria: "Mercado",
    palabras: ["mercado", "agro", "bodega", "placita"],
    compatibles: ["Tienda"],
  },
  {
    categoria: "Servicio",
    palabras: [
      "barberia",
      "barber",
      "peluqueria",
      "salon de belleza",
      "manicura",
      "unas",
      "taller",
      "mecanico",
      "ponchera",
      "reparacion",
      "tecnico",
      "gimnasio",
      "academia",
      "clases",
      "taxi",
      "transporte",
      "mensajeria",
      "fotografia",
    ],
  },
  {
    categoria: "Hospedaje",
    palabras: ["hostal", "hotel", "habitacion", "habitaciones", "alojamiento", "casa particular"],
  },
  {
    categoria: "Cultura",
    palabras: ["museo", "galeria", "teatro", "cultura", "exposicion"],
  },
  {
    categoria: "Naturaleza",
    palabras: ["parque", "rio", "sendero", "naturaleza", "bosque"],
  },
  {
    categoria: "Playa",
    palabras: ["playa", "arena", "mar"],
  },
];

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

function contienePalabra(texto: string, palabra: string): boolean {
  /* Límites de palabra para que «bar» no salga dentro de «barbería». Las
     palabras largas sí valen dentro de otra: «elitoBarber» lleva «barber». */
  const escapada = palabra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`(^|[^a-z0-9])${escapada}([^a-z0-9]|$)`, "i").test(texto)) {
    return true;
  }
  return palabra.length >= 5 && texto.includes(palabra);
}

function reglaPara(texto: string): { regla: Regla; palabra: string } | null {
  const normal = normalizar(texto);
  for (const regla of REGLAS) {
    for (const palabra of regla.palabras) {
      if (contienePalabra(normal, palabra)) return { regla, palabra };
    }
  }
  return null;
}

/**
 * Devuelve los sospechosos ordenados por confianza y nombre. Sin duplicados.
 */
export function detectarTiposSospechosos(
  lugares: readonly LugarParaRevisar[],
): SospechaTipo[] {
  const sospechosos: SospechaTipo[] = [];

  for (const lugar of lugares) {
    const categoria = lugar.category?.trim() || "Otro";
    const enNombre = reglaPara(lugar.name);
    const enProductos = (lugar.productos ?? [])
      .map((producto) => ({ producto, regla: reglaPara(producto) }))
      .filter(
        (item): item is { producto: string; regla: { regla: Regla; palabra: string } } =>
          item.regla !== null,
      );

    /* El nombre pesa más que la carta: un restaurante puede vender una pizza
       sin dejar de ser restaurante; una pizzería llamada «Pizzería» no. */
    const candidatos = new Map<string, { regla: Regla; coincidencias: string[]; confianza: number }>();

    if (enNombre) {
      candidatos.set(enNombre.regla.categoria, {
        regla: enNombre.regla,
        coincidencias: [lugar.name],
        confianza: 2,
      });
    }

    for (const { producto, regla } of enProductos) {
      const actual = candidatos.get(regla.regla.categoria);
      if (actual) {
        actual.coincidencias.push(producto);
        actual.confianza = Math.max(actual.confianza, 2);
      } else {
        candidatos.set(regla.regla.categoria, {
          regla: regla.regla,
          coincidencias: [producto],
          confianza: 1,
        });
      }
    }

    const mejor = [...candidatos.entries()]
      .filter(([sugerida, datos]) => {
        if (sugerida === categoria) return false;
        if (datos.regla.compatibles?.includes(categoria)) return false;
        /* Solo los productos, sin el nombre, necesitan al menos dos
           coincidencias: una carta con «café» no convierte una tienda en
           cafetería. */
        if (datos.confianza === 1 && datos.coincidencias.length < 2) return false;
        return true;
      })
      .sort((a, b) => b[1].confianza - a[1].confianza || b[1].coincidencias.length - a[1].coincidencias.length)[0];

    if (!mejor) continue;

    const [sugerida, datos] = mejor;
    const coincidencias = [...new Set(datos.coincidencias)].slice(0, 3);
    const motivo =
      datos.confianza === 2
        ? `El nombre o la carta apuntan a ${sugerida}, pero la ficha está en ${categoria}.`
        : `La carta tiene ${coincidencias.length} coincidencias con ${sugerida}, pero la ficha está en ${categoria}.`;

    sospechosos.push({
      id: lugar.id,
      name: lugar.name,
      category: categoria,
      sugerida,
      motivo,
      coincidencias,
      confianza: datos.confianza,
    });
  }

  return sospechosos.sort(
    (a, b) => b.confianza - a.confianza || a.name.localeCompare(b.name, "es"),
  );
}
