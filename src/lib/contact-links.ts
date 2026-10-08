/**
 * El contacto que el dueño escribe a mano, convertido en enlaces que se pueden abrir.
 *
 * Los cuatro campos son texto libre —la base no valida nada, a propósito, porque
 * un sitio web sin protocolo, un `@` de Instagram o un teléfono cubano se escriben
 * de mil formas— y quien los normaliza es este archivo. Está separado de la ficha
 * porque no es cosa de la vista: el mismo `wa.me` y las mismas redes que pinta
 * `PlaceDetail` los quiere el `sameAs` del marcado estructurado.
 *
 * Devuelve `undefined` en los que no haya: la ficha entiende eso como «no pintar
 * el botón», que es exactamente lo que hace falta cuando el dueño dejó el campo
 * vacío.
 */

/** El contacto tal como llega de la base o del formulario. */
export interface ContactInfo {
  /** `tusitio.com`, `www.tusitio.com` o la URL entera. */
  website?: string;
  /** `+53 5 123 4567`, `5351234567`, lo que sea. */
  whatsapp?: string;
  /** `@laverde`, `laverde` o la URL entera. */
  instagram?: string;
  /** `facebook.com/laverde`, `laverde` o la URL entera. */
  facebook?: string;
}

/** Los mismos campos, ya convertidos en href listo para un `<a>`. */
export type ContactLinks = {
  [K in keyof ContactInfo]?: string;
};

/** `laverde.cu` → `https://laverde.cu`. Una URL ya escrita se queda como está. */
function withProtocol(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Un número cualquiera → `https://wa.me/<número>`.
 *
 * WhatsApp espera el número internacional **sin** `+`, sin espacios y sin el
 * prefijo de país `00`, así que todo lo que no sea dígito se tira y un `00`
 * inicial se quita. `+53 5 123 4567` y `005351234567` acaban en el mismo sitio.
 */
export function whatsappHref(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^00/, "");
  return digits ? `https://wa.me/${digits}` : "";
}

/**
 * Un número de WhatsApp escrito a la cubana → `+53XXXXXXXX`, o `null` si no lo
 * es.
 *
 * El `+53` es del país, así que se acepta escrito o no —`+53 5 123 4567`,
 * `53 51234567`, `0053 51234567`, `5 123 4567`— y siempre sale normalizado con
 * el prefijo puesto: quien lee la ficha no tiene que adivinar de dónde es el
 * número, y el enlace de `wa.me` sale igual con las dos formas.
 *
 * El largo del número local es lo único que se comprueba (6 a 8 dígitos, que
 * cubre el móvil de 8, La Habana de 7 y las provincias de 6). **No** se mira el
 * prefijo de operador: las series cambian, y rechazar un número bueno por una
 * lista desactualizada es peor que aceptar uno raro —el dueño lo ve en su ficha
 * y lo corrige—.
 */
export function normalizarWhatsappCubano(value: string): string | null {
  const digits = value.replace(/\D/g, "").replace(/^00/, "");
  const local = digits.startsWith("53") ? digits.slice(2) : digits;
  if (!/^\d{6,8}$/.test(local)) return null;
  return `+53${local}`;
}

/**
 * Un usuario o una URL de red social → la URL del perfil.
 *
 * Admite las dos formas en que la gente lo escribe: `@laverde` o `laverde` —que
 * se cuelgan del dominio que se le pase— y `instagram.com/laverde` o la URL
 * entera, que se dejan tal cual (con `www.` si venían sin protocolo, que es el
 * caso de pegar «facebook.com/…» tal cual).
 */
function socialHref(value: string, profileBase: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  /* Con dominio propio no se cuelga del `profileBase`: «facebook.com/x» debe ir
     a Facebook, no a `https://www.instagram.com/facebook.com/x`. */
  if (/\.[a-z]{2,}(\/|$)/i.test(trimmed))
    return `https://www.${trimmed.replace(/^www\./i, "")}`;
  return `${profileBase}${trimmed.replace(/^@/, "")}`;
}

/**
 * Convierte el contacto de un negocio en los enlaces de su ficha.
 *
 * Los vacíos salen como `undefined`, no como cadena en blanco: así quien pinta
 * decide con un `&&` y no tiene que comprobar longitudes.
 */
export function contactLinks(contact: ContactInfo): ContactLinks {
  const website = withProtocol(contact.website ?? "");
  const whatsapp = whatsappHref(contact.whatsapp ?? "");
  const instagram = socialHref(
    contact.instagram ?? "",
    "https://www.instagram.com/",
  );
  const facebook = socialHref(
    contact.facebook ?? "",
    "https://www.facebook.com/",
  );

  return {
    website: website || undefined,
    whatsapp: whatsapp || undefined,
    instagram: instagram || undefined,
    facebook: facebook || undefined,
  };
}
