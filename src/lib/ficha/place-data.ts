/**
 * La traducción de `UserPlace` al `PlaceData` que pinta la ficha.
 *
 * Es un módulo puro —sin React y sin base de datos— por dos motivos. El primero
 * es que la ficha pública y la vista previa del panel tienen que enseñar
 * exactamente lo mismo: con la reconstrucción dentro de un componente de
 * cliente, la vista previa acabaría teniendo su propia copia. El segundo es que
 * una reconstrucción explícita es una lista blanca silenciosa: lo que no se
 * nombre aquí se cae al pintar, así que merece una prueba propia.
 *
 * Aquí también se resuelven las ofertas vivas, el contacto y la reserva: la
 * ficha solo pinta, no sabe de fechas ni de números de teléfono.
 */

import type { ReactNode } from "react";
import type { Slide } from "@/components/place/photo-carousel";
import type { ContactLinks } from "@/lib/contact-links";
import type { Disponibilidad } from "@/lib/disponibilidad";
import type { EnergiaRespaldo } from "@/lib/energia";
import type { ReservaConfig } from "@/lib/reserva";
import type { SeguidorConfig } from "@/lib/seguidores";
import type { ProjectOfferPackage } from "@/lib/db/schema/project_requests";
import type {
  UserPlace,
  UserPlaceMenuItem,
  UserPlacePhoto,
  UserPlaceReview,
} from "@/lib/places-store";
import { contactLinks, whatsappDePedido } from "@/lib/contact-links";
import { configReserva } from "@/lib/reserva";
import { configSeguidores } from "@/lib/seguidores";
import { formatDateRange, formatMenuPrice } from "@/lib/utils";
import { ofertaDe, ofertasVigentes, precioConOferta } from "@/lib/ofertas";
import type { Acciones } from "./acciones";
import type { EntregaConfig } from "./entrega";
import type { Horario } from "./horario";
import type {
  ComoAtiende,
  ComoComprar,
  EspecialDelDia,
  ExistenciasModo,
  MenuCategoria,
  ModuloFicha,
  PortadaEncuadre,
  TipoNegocio,
} from "./tipos";
import { COPY } from "@/config/ficha";

export type PlaceState = "normal" | "closed" | "no-photos" | "oferta";

export interface PlaceMenu {
  /** El `id` de la entrada original. Es lo que enlaza la oferta con su fila. */
  id?: string;
  name: string;
  description: string;
  /** Texto libre. Ver `UserPlaceMenuItem`: no es un número. */
  price: string;
  currency: string;
  tag?: string;
  category?: string;
  image?: string;
  disponibilidad?: Disponibilidad;
  agotadoHasta?: number | null;
  /**
   * El precio que se tacha y el rebajado, ya resueltos —con la moneda puesta—
   * por `precioConOferta` al construir el `PlaceData`.
   */
  oferta?: { de: string; por: string };
  stock?: number;
  duracionMin?: number;
  tipoPrecio?: "fijo" | "desde" | "consultar";
  destacado?: boolean;
}

/** Una oferta flash ya resuelta para pintar: sin fechas crudas ni carta a mano. */
export interface PlaceOffer {
  id: string;
  titulo: string;
  descripcion?: string;
  /** «Termina el 12 de octubre, 19:30», ya en texto. */
  termina: string;
  precio?: { de: string; por: string };
}

/** Una foto de la ficha, con la sección que eligió el dueño. */
export interface PlacePhoto extends Slide {
  seccion: "local" | "trabajos";
}

/** La valoración que la ficha puede enseñar: media y número que la forman. */
export interface PlaceRating {
  promedio: number;
  total: number;
}

export interface PlaceData {
  id: string;
  slug: string;
  name: string;
  category: string;
  isProject?: boolean;
  projectOffers?: string | null;
  projectOfferPackages?: ProjectOfferPackage[];
  /**
   * La nota denormalizada de `places.rating`.
   *
   * Se conserva para los proyectos, que la pintan como un número suelto. La
   * ficha de negocio usa `reviewsStats`, que sale de las reseñas reales.
   */
  rating: number;
  /** La valoración viva. `null` = la ficha no debe enseñar cifras. */
  reviewsStats: PlaceRating | null;
  /** La reseña que el negocio destacó, si eligió una. */
  resenaDestacada: UserPlaceReview | null;
  distance: string;
  logoUrl?: string;
  barrio: string;
  city?: string;
  province?: string;
  schedule: string;
  address?: string;
  payments: string[];
  description: string;
  shortDescription?: string;
  /**
   * Alias de `description` para la maqueta de proyectos, que lo usa desde antes
   * de que existiera esta separación. Ya no lleva ningún texto de relleno: si el
   * proyecto no escribió descripción, se queda vacío y la sección se oculta.
   */
  longDescription: string;
  isOpen: boolean;
  closedMessage?: string;
  vibe: string[];
  aiTags: string[];
  priceLabel?: string;
  energiaRespaldo?: EnergiaRespaldo | null;
  notaApagon?: string;
  icon?: string;
  isBoosted?: boolean;
  selloVerificado?: boolean;
  topDelMes?: boolean;
  slides: Slide[];
  /** La galería, separada por lo que es el local y lo que son trabajos. */
  galeria: { local: PlacePhoto[]; trabajos: PlacePhoto[] };
  menu: PlaceMenu[];
  contact: ContactLinks;
  /** Teléfono de la ficha, para el botón «Llamar». */
  phone?: string;
  reserva?: ReservaConfig;
  seguidores?: SeguidorConfig;
  ofertas?: PlaceOffer[];
  /**
   * A quién viaja el pedido, en dígitos (`5353151049`): el WhatsApp del negocio
   * o, cuando no lo puso, su teléfono. `undefined` = no hay a dónde mandarlo.
   */
  pedidoWhatsapp?: string;
  /** Si se puede pedir ahora (plan + interruptor + número + carta). */
  pedidosHabilitado: boolean;
  /** Si se puede reservar ahora (plan + interruptor + WhatsApp). */
  reservaHabilitada: boolean;

  /* ── Ficha por tipo ────────────────────────────────────────────────── */
  tipoNegocio?: TipoNegocio | null;
  modulosActivos: ModuloFicha[];
  atributos: string[];
  colorMarca: string | null;
  portadaEncuadre: PortadaEncuadre | null;
  acciones: Acciones | null;
  horario: Horario | null;
  cerradoMensaje: string | null;
  entrega: EntregaConfig | null;
  comoComprar: ComoComprar | null;
  comoAtiende: ComoAtiende | null;
  especialDia: EspecialDelDia | null;
  catalogoTitulo: string | null;
  menuCategorias: MenuCategoria[] | null;
  existenciasModo: ExistenciasModo;
  catalogoActualizadoEn: number | null;
  status: "active" | "closed" | "temporary_closed";
}

export interface PlaceDetailProps {
  place: PlaceData;
  state?: PlaceState;
  onBack?: () => void;
  onShare?: () => void;
  onNavigate?: () => void;
  footerSlot?: ReactNode;
  className?: string;
  /**
   * El «ahora» del servidor, en ISO. La ficha lo usa para pintar el HTML
   * inicial con el estado correcto y luego recalcularlo en el navegador cada
   * minuto; sin esto, el reloj del servidor y el del cliente podrían discrepar
   * en la hidratación.
   */
  nowIso?: string;
}

function fechaLarga(ms: number): string {
  return new Date(ms).toLocaleString("es-CU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function foto(photo: UserPlacePhoto, index: number, name: string): PlacePhoto {
  return {
    url: photo.url,
    alt: photo.alt || `Foto ${index + 1} de ${name}`,
    width: photo.width,
    height: photo.height,
    seccion: photo.seccion === "trabajos" ? "trabajos" : "local",
  };
}

export function userPlaceToPlaceData(p: UserPlace): PlaceData {
  const vigentes = ofertasVigentes(p.ofertas);
  const fotos = (p.photos ?? []).map((photo, i) => foto(photo, i, p.name));

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    isProject: p.isProject ?? false,
    projectOffers: p.isProject ? (p.offer?.text ?? null) : null,
    projectOfferPackages: p.isProject ? (p.offerPackages ?? []) : [],
    rating: p.rating ?? 0,
    reviewsStats: p.reviewsStats ?? null,
    resenaDestacada: p.resenaDestacada ?? null,
    distance: p.distanceLabel || p.address || "",
    address: p.address,
    logoUrl: p.logoUrl,
    barrio: p.barrio || "Cuba",
    city: p.city,
    province: p.province,
    /* Las fechas de un proyecto, legibles. Para un negocio, el texto libre del
       dueño tal cual: la ficha no inventa un horario que no está en la base. */
    schedule:
      p.isProject && p.schedule ? formatDateRange(p.schedule) : p.schedule,
    payments: p.payments,
    description: p.description,
    shortDescription: p.shortDescription?.trim() || undefined,
    longDescription: p.description,
    isOpen: p.status === "active",
    closedMessage:
      p.cerradoMensaje?.trim() ||
      (p.status === "closed" || p.status === "temporary_closed"
        ? COPY.cerradoTemporal
        : undefined),
    vibe: p.vibe ?? [],
    aiTags: p.aiTags ?? [],
    priceLabel: p.priceLabel,
    energiaRespaldo: p.energiaRespaldo ?? null,
    notaApagon: p.notaApagon,
    icon: p.icon,
    isBoosted: p.isBoosted,
    selloVerificado: p.selloVerificado ?? false,
    topDelMes: p.topDelMes ?? false,
    /* Sin fotos la lista va vacía y `PortadaMarca` decide el respaldo de marca:
       no se inventan degradados ni etiquetas «El lugar» / «Ambiente». */
    slides: fotos,
    galeria: {
      /* La portada ya se ve arriba; el resto —sin repetirla— es la galería. Se
         quita por posición y no por URL: si la portada es un trabajo, la sección
         de trabajos tampoco debe enseñarla dos veces. */
      local: fotos.slice(1).filter((f) => f.seccion === "local"),
      trabajos: fotos.slice(1).filter((f) => f.seccion === "trabajos"),
    },
    menu: p.menu
      .filter((item) => item.name.trim().length > 0 && !item.oculto)
      .map((item: UserPlaceMenuItem) => {
        const oferta = item.id ? ofertaDe(vigentes, item.id) : undefined;
        const precios = oferta ? precioConOferta(item.price, oferta) : null;
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          currency: item.currency || "MLC",
          tag: item.tag,
          category: item.category,
          image: item.image,
          disponibilidad: item.disponibilidad,
          agotadoHasta: item.agotadoHasta,
          oferta: precios ?? undefined,
          stock: item.stock,
          duracionMin: item.duracionMin,
          tipoPrecio: item.tipoPrecio,
          destacado: item.destacado,
        };
      }),
    ofertas: vigentes.map((oferta) => {
      const producto = p.menu.find((item) => item.id === oferta.productoId);
      const precios = producto ? precioConOferta(producto.price, oferta) : null;
      return {
        id: oferta.id,
        titulo: oferta.titulo,
        descripcion: oferta.descripcion,
        termina: `Termina el ${fechaLarga(oferta.termina)}`,
        precio:
          precios && producto
            ? {
                de: formatMenuPrice(precios.de, producto.currency || "MLC"),
                por: formatMenuPrice(precios.por, producto.currency || "MLC"),
              }
            : undefined,
      };
    }),
    contact: contactLinks({
      website: p.website,
      whatsapp: p.whatsapp,
      instagram: p.instagram,
      facebook: p.facebook,
    }),
    phone: p.phone,
    reserva: configReserva(p),
    seguidores: configSeguidores(p),
    /* A quién va el pedido: el WhatsApp o, si el dueño solo puso teléfono, ese
       móvil. Sin esto un negocio con el carrito encendido y sin WhatsApp
       aparte se quedaba sin botón de confirmar. */
    pedidoWhatsapp: whatsappDePedido(p.whatsapp, p.phone) ?? undefined,
    pedidosHabilitado: p.pedidosHabilitado === true,
    reservaHabilitada: p.reservaHabilitada === true,
    tipoNegocio: p.tipoNegocio ?? null,
    modulosActivos: p.modulosActivos ?? [],
    atributos: p.atributos ?? [],
    colorMarca: p.colorMarca ?? null,
    portadaEncuadre: p.portadaEncuadre ?? null,
    acciones: p.acciones ?? null,
    horario: p.horario ?? null,
    cerradoMensaje: p.cerradoMensaje ?? null,
    entrega: p.entrega ?? null,
    comoComprar: p.comoComprar ?? null,
    comoAtiende: p.comoAtiende ?? null,
    especialDia: p.especialDia ?? null,
    catalogoTitulo: p.catalogoTitulo ?? null,
    menuCategorias: p.menuCategorias ?? null,
    existenciasModo: p.existenciasModo ?? "disponible",
    catalogoActualizadoEn: p.catalogoActualizadoEn ?? null,
    status: p.status,
  };
}
