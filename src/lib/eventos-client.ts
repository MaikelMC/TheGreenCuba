import type { TipoEvento } from "@/lib/eventos";

/**
 * Manda los gestos del negocio a `/api/negocio/evento`.
 *
 * **`sendBeacon` y no `fetch`** porque el gesto que más interesa contar es el
 * último: el clic en «Llamar» que saca al usuario del sitio. Un `fetch` normal
 * muere con la página; el beacon lo entrega el navegador aunque la pestaña ya se
 * esté cerrando. Es también lo que permite juntar los productos vistos y
 * mandarlos **de una vez** al salir, en vez de uno por producto: la carta la
 * abre gente con datos móviles contados.
 *
 * La identidad del visitante es una **cookie anónima** (`lv_anon`): un número al
 * azar, sin nada de la persona. El servidor la hashea junto al negocio y al día,
 * así que ni siquiera la cookie viaja a la base —lo que se guarda es un hash que
 * mañana ya no vale—. Se escribe aquí, en el cliente, para que exista **antes**
 * del primer beacon: si la pusiera el servidor en la respuesta, la primera
 * visita contaría como dos.
 */

const COOKIE = "lv_anon";
const URL = "/api/negocio/evento";

export interface EventoSaliente {
  tipo: TipoEvento;
  negocioId: string;
  /** Sub-dato del evento. Solo `producto_visto` lo usa: el nombre del producto. */
  dimension?: string;
}

/** La cookie anónima, creándola si es la primera vez. */
function idAnonimo(): string {
  const actual = document.cookie.match(/(?:^|;\s*)lv_anon=([^;]+)/)?.[1];
  if (actual) return actual;

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  document.cookie = `${COOKIE}=${id};path=/;max-age=31536000;samesite=lax`;
  return id;
}

/**
 * Un solo beacon con todos los eventos. Los vacíos no se mandan: un viaje de
 * red para nada se nota en una conexión mala.
 */
export function trackEventos(eventos: EventoSaliente[]): void {
  if (typeof window === "undefined" || eventos.length === 0) return;

  idAnonimo();

  const cuerpo = new Blob([JSON.stringify({ eventos })], {
    type: "application/json",
  });

  if (navigator.sendBeacon?.(URL, cuerpo)) return;
  /* Sin `sendBeacon` —navegador viejo— el `fetch` con `keepalive` es lo más
     parecido: sobrevive a la navegación aunque no garantiza la entrega. */
  void fetch(URL, { method: "POST", body: cuerpo, keepalive: true }).catch(
    () => {},
  );
}

/** El caso de un solo gesto, que es el de todos los clics. */
export function trackEvento(evento: EventoSaliente): void {
  trackEventos([evento]);
}
