import { cartaYQr } from "./carta-y-qr";
import { tasaDelDia } from "./tasa-del-dia";
import { ofertasYNovedades } from "./ofertas-y-novedades";
import { flujoAtencionPedidos } from "./flujo-atencion-pedidos";
import { horarioDeCocina } from "./horario-de-cocina";
import { pedidosProgramados } from "./pedidos-programados";
import { clienteFrecuente } from "./cliente-frecuente";

export type { ServicioContent, EjemploTipo, PrecioPieza } from "./_tipos";

export const SERVICIOS = [
  cartaYQr,
  tasaDelDia,
  ofertasYNovedades,
  flujoAtencionPedidos,
  horarioDeCocina,
  pedidosProgramados,
  clienteFrecuente,
] as const;

export function getServicio(slug: string) {
  return SERVICIOS.find((s) => s.slug === slug) ?? null;
}
