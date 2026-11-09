import { NoExiste } from "@/components/menu/tarjeta-no-existe";

/**
 * El 404 de la tarjeta.
 *
 * `notFound()` desde la página sale con un 404 real —y con este cuerpo—, no
 * con un 200 de cortesía. El service worker lo necesita para saber que la
 * tarjeta ya no vale y borrar su copia.
 */
export default function TarjetaNoEncontrada() {
  return <NoExiste />;
}
