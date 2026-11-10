import type { ClaveModulo, Funcion } from "@/lib/plans";

export type EjemploTipo =
  | "carta-qr"
  | "tasa"
  | "ofertas"
  | "pedidos"
  | "horario"
  | "programados"
  | "cliente-frecuente";

export type PrecioPieza =
  | { tipo: "modulo"; clave: ClaveModulo }
  | { tipo: "incluido"; en: ClaveModulo };

export interface ServicioContent {
  slug: string;
  titulo: string;
  nombre: string;
  descripcionCorta: string;
  categoria: string;
  precio: PrecioPieza;
  /** Función principal para comprobar si el negocio ya lo tiene. */
  funcion: Funcion;
  /** URL del panel donde configurarlo si ya lo tienen, p.ej. "/business?seccion=pedidos". */
  anclaPanel: string;
  tePasaEsto: string[];
  asFunciona: string[];
  loQueIncluye: string[];
  loQueNoHace: string[];
  queNecesitas: string[];
  preguntas: Array<{ pregunta: string; respuesta: string }>;
  ejemploTipo: EjemploTipo;
}
