import {
  Beef,
  Beer,
  Cake,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Fish,
  IceCream,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  Utensils,
  Wine,
  type LucideIcon,
} from "lucide-react";

/**
 * El icono de un producto sin foto. Se elige por lo que dice el nombre —un café
 * no se parece a una pizza— y, si no reconoce nada, cae al genérico de la vista:
 * cubiertos en las cartas de comida y una caja en la tienda. Va por palabra, sin
 * acentos, para que «Café» y «cafe» den lo mismo.
 *
 * Vive aquí y no dentro de `catalogo.tsx` porque la ficha demo (`/demo/yoyi`)
 * enseña el mismo hueco: dos listas de palabras acabarían separándose y el
 * icono de un «capuchino» sería distinto en cada pantalla.
 */
const ICONOS_PRODUCTO: [RegExp, LucideIcon][] = [
  [/\b(cafe|capuchino|cortadito|espresso|te|infusion|chocolate)\b/, Coffee],
  [/\b(pizza|pizzeta|calzone)\b/, Pizza],
  [/\b(helado|granizado)\b/, IceCream],
  [/\b(pastel|cake|flan|postre|torta|bizcocho|dulce)\b/, Cake],
  [/\b(galleta|galletas|churro|churros|panetela)\b/, Cookie],
  [/\b(pan|croissant|tostada|tostadas|desayuno)\b/, Croissant],
  [/\b(cerveza|cervezas|bucanero|cristal|mojito)\b/, Beer],
  [/\b(vino|ron|cocktail|coctel|trago|copa)\b/, Wine],
  [/\b(refresco|jugo|zumo|malta|cola|agua|limonada|batido)\b/, CupSoda],
  [/\b(hamburguesa|sandwich|sandwiches|perro|bocadillo|toston|croqueta|croquetas)\b/, Sandwich],
  [/\b(ensalada|vegetal|vegetales|vegetariano)\b/, Salad],
  [/\b(sopa|caldo|ajiaco|potaje|crema)\b/, Soup],
  [/\b(pescado|camaron|camarones|langosta|mariscos|marisco)\b/, Fish],
  [/\b(carne|bistec|cerdo|res|chuleta|costilla|filete)\b/, Beef],
];

/** El icono que mejor representa el nombre del producto. */
export function iconoDeProducto(
  nombre: string,
  generico: LucideIcon = Utensils,
): LucideIcon {
  const limpio = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return ICONOS_PRODUCTO.find(([patron]) => patron.test(limpio))?.[1] ?? generico;
}
