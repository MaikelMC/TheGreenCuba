/**
 * El catálogo de servicios por categoría de negocio.
 *
 * Sale de `SERVICIOS-POR-CATEGORIA.md`, que es el documento que decide qué se
 * vende. Aquí solo se ordena para que la página pueda pintarlo: cada servicio
 * con su estado —lo que ya existe y lo que está por llegar— y cada categoría
 * con un pack armado con los módulos que de verdad la completan.
 *
 * `estado: "proximo"` no es un descuento ni una versión beta: es un servicio
 * que todavía no existe en La Verde. Se enseña para que el dueño sepa que va a
 * estar, y su CTA es «Avísame» por WhatsApp, no un cobro.
 *
 * `modulo` y `plan` dicen con qué pieza del catálogo de `src/lib/plans.ts` se
 * activa. Un servicio sin ninguno de los dos es de Gratis: no hay nada que
 * cobrar, y su CTA es empezar.
 *
 * Los módulos de los packs sugeridos se cobran por separado —lo que cuesta cada
 * uno—, así que ningún pack lleva dos módulos que ya se incluyan entre sí.
 */

import type { ClaveModulo, Pack } from "@/lib/plans";

export type EstadoServicio = "ya" | "proximo";

export interface ServicioCatalogo {
  nombre: string;
  estado: EstadoServicio;
  /** Ficha extendida que ya existe en `/servicios/[slug]`. */
  ficha?: string;
  /** Módulo suelto que lo activa. */
  modulo?: ClaveModulo;
  /** Pack estándar que lo trae, cuando no hay módulo suelto. */
  plan?: Pack;
}

export interface PackSugerido {
  nombre: string;
  lema: string;
  modulos: readonly ClaveModulo[];
  /** Lo que el pack completa del negocio, en una línea por punto. */
  completa: readonly string[];
}

export interface CategoriaServicios {
  slug: string;
  nombre: string;
  /** Etiqueta corta del filtro. */
  corto: string;
  descripcion: string;
  pack: PackSugerido;
  servicios: readonly ServicioCatalogo[];
}

const FACEBOOK = (nombre: string): ServicioCatalogo => ({
  nombre,
  estado: "ya",
  plan: "esencial",
});

export const CATEGORIAS: readonly CategoriaServicios[] = [
  {
    slug: "cualquier-negocio",
    nombre: "Cualquier negocio",
    corto: "Cualquiera",
    descripcion:
      "Lo que lleva todo negocio que aparece en La Verde, sin importar a qué se dedica.",
    pack: {
      nombre: "Base + asistente",
      lema: "La carta sin nuestra marca y tu menú editable desde Telegram.",
      modulos: ["menu_pro", "asistente_telegram"],
      completa: [
        "Carta ilimitada, sin la marca de La Verde y con «Hoy hay»",
        "Precios con la tasa del día en CUP",
        "Edita tu menú desde Telegram sin abrir el panel",
        "Avisos a seguidores incluidos en el plan Esencial",
      ],
    },
    servicios: [
      { nombre: "Pin en el mapa y búsqueda con IA", estado: "ya" },
      {
        nombre:
          "Ficha completa: horario, contacto, fotos, monedas y energía de respaldo",
        estado: "ya",
      },
      { nombre: "Reseñas y valoración", estado: "ya" },
      { nombre: "Contador de visitas y estadísticas", estado: "ya" },
      { nombre: "Equipo con permisos", estado: "ya" },
      {
        nombre: "Precios con tasa del día: USD con el CUP calculado",
        estado: "ya",
        modulo: "menu_pro",
      },
      { nombre: "Avisos a seguidores", estado: "ya", plan: "esencial" },
      FACEBOOK("Publicaciones en grupos de Facebook (1 o 3 por semana)"),
      { nombre: "Asistente de Telegram", estado: "ya", modulo: "asistente_telegram" },
      { nombre: "Ranking mensual", estado: "ya", plan: "pro" },
      { nombre: "Flyers automáticos", estado: "proximo" },
      { nombre: "Reporte mensual", estado: "proximo" },
      { nombre: "Kit para estados de WhatsApp", estado: "proximo" },
    ],
  },

  {
    slug: "alimentos",
    nombre: "Mipyme de alimentos y productos varios",
    corto: "Alimentos",
    descripcion:
      "Vendes comida, bebida o productos de despensa y quieres que te pidan sin llamarte.",
    pack: {
      nombre: "Mipyme que vende",
      lema: "Catálogo, pedidos con domicilio y presencia en Facebook.",
      modulos: ["pedidos_reservas", "facebook"],
      completa: [
        "Catálogo con fotos, «Hoy hay» y productos ilimitados",
        "Pedidos por WhatsApp con dirección y costo de domicilio",
        "Apartados y una publicación semanal en grupos de Facebook",
      ],
    },
    servicios: [
      {
        nombre: "Catálogo con fotos y «Hoy hay»",
        estado: "ya",
        modulo: "menu_pro",
        ficha: "carta-y-qr",
      },
      {
        nombre: "Ofertas y novedades",
        estado: "ya",
        modulo: "menu_pro",
        ficha: "ofertas-y-novedades",
      },
      {
        nombre: "Pedidos por WhatsApp con dirección",
        estado: "ya",
        modulo: "pedidos_reservas",
        ficha: "flujo-atencion-pedidos",
      },
      { nombre: "Apartados", estado: "ya", modulo: "pedidos_reservas" },
      { nombre: "Zonas y costo de domicilio", estado: "ya", modulo: "pedidos_reservas", ficha: "zonas-domicilio" },
      { nombre: "«Avísame cuando haya»", estado: "proximo" },
      { nombre: "Lista de precios por mayor", estado: "proximo" },
      { nombre: "Cupones por WhatsApp", estado: "proximo" },
      { nombre: "Sistema de gestión: inventario, caja y reportes", estado: "proximo" },
      { nombre: "Sincronización de existencias con el catálogo", estado: "proximo" },
    ],
  },

  {
    slug: "cafeteria",
    nombre: "Cafetería",
    corto: "Cafetería",
    descripcion:
      "Atiendes en mesa y para llevar, con clientes que vuelven todas las mañanas.",
    pack: {
      nombre: "Cafetería con clientes de siempre",
      lema: "Menú QR, pedidos y una tarjeta de sellos que los hace volver.",
      modulos: ["pedidos_reservas", "cliente_frecuente"],
      completa: [
        "Menú QR con fotos y «Hoy hay»",
        "Pedidos y reservas de mesa por WhatsApp",
        "Tarjeta de sellos digital: el décimo café, gratis",
      ],
    },
    servicios: [
      {
        nombre: "Menú QR con fotos y «Hoy hay»",
        estado: "ya",
        modulo: "menu_pro",
        ficha: "carta-y-qr",
      },
      {
        nombre: "Ofertas y novedades",
        estado: "ya",
        modulo: "menu_pro",
        ficha: "ofertas-y-novedades",
      },
      {
        nombre: "Pedidos por WhatsApp con dirección",
        estado: "ya",
        modulo: "pedidos_reservas",
        ficha: "flujo-atencion-pedidos",
      },
      { nombre: "Reservas de mesa", estado: "ya", modulo: "pedidos_reservas" },
      { nombre: "Zonas y costo de domicilio", estado: "ya", modulo: "pedidos_reservas", ficha: "zonas-domicilio" },
      { nombre: "Pedido para recoger con hora", estado: "proximo" },
      {
        nombre: "Cliente frecuente: tarjeta de sellos digital",
        estado: "ya",
        modulo: "cliente_frecuente",
        ficha: "cliente-frecuente",
      },
      { nombre: "Cupones por WhatsApp", estado: "proximo" },
      { nombre: "Sistema de gestión: caja, insumos y cuadre", estado: "proximo" },
    ],
  },

  {
    slug: "restaurante",
    nombre: "Restaurante o paladar",
    corto: "Restaurante",
    descripcion:
      "Mesa, menú del día y celebraciones. Lo importante es que la reserva no se pierda.",
    pack: {
      nombre: "Restaurante sin llamadas",
      lema: "Reservas con aforo, pedidos a domicilio y visibilidad en Facebook.",
      modulos: ["pedidos_reservas", "facebook"],
      completa: [
        "Menú QR con fotos, «Hoy hay» y menú del día",
        "Reservas con aforo y pedidos con costo de domicilio",
        "Una publicación semanal en grupos de Facebook",
      ],
    },
    servicios: [
      {
        nombre: "Menú QR con fotos y «Hoy hay»",
        estado: "ya",
        modulo: "menu_pro",
        ficha: "carta-y-qr",
      },
      {
        nombre: "Ofertas y novedades",
        estado: "ya",
        modulo: "menu_pro",
        ficha: "ofertas-y-novedades",
      },
      {
        nombre: "Reservas de mesa con aforo",
        estado: "ya",
        modulo: "pedidos_reservas",
      },
      {
        nombre: "Pedidos por WhatsApp con dirección",
        estado: "ya",
        modulo: "pedidos_reservas",
        ficha: "flujo-atencion-pedidos",
      },
      { nombre: "Zonas y costo de domicilio", estado: "ya", modulo: "pedidos_reservas", ficha: "zonas-domicilio" },
      { nombre: "Menú del día", estado: "ya", modulo: "menu_pro" },
      { nombre: "Reservas para grupos y celebraciones, con anticipo", estado: "proximo" },
      { nombre: "Eventos y pin destacado", estado: "proximo" },
      { nombre: "Comandas por mesa para meseros y cocina", estado: "proximo" },
      { nombre: "Sistema de gestión: caja, insumos y cuadre", estado: "proximo" },
    ],
  },

  {
    slug: "comida-a-domicilio",
    nombre: "Comida a domicilio",
    corto: "Domicilio",
    descripcion:
      "Cocinas en casa y vendes por WhatsApp. Aquí está lo que ya tienes explicado con detalle.",
    pack: {
      nombre: "Cocina completa",
      lema: "Pedidos, horario de cocina, encargos por hora y sellos.",
      modulos: ["pedidos_reservas", "pedidos_programados", "cliente_frecuente"],
      completa: [
        "Catálogo con «Hoy hay» y pedidos con domicilio",
        "Horario de cocina: los pedidos entran solo cuando puedes",
        "Pedidos programados y tarjeta de sellos para los de siempre",
      ],
    },
    servicios: [
      {
        nombre: "Catálogo con fotos y «Hoy hay»",
        estado: "ya",
        modulo: "menu_pro",
        ficha: "carta-y-qr",
      },
      {
        nombre: "Pedidos por WhatsApp con dirección",
        estado: "ya",
        modulo: "pedidos_reservas",
        ficha: "flujo-atencion-pedidos",
      },
      {
        nombre: "Ofertas y novedades",
        estado: "ya",
        modulo: "menu_pro",
        ficha: "ofertas-y-novedades",
      },
      {
        nombre: "Zonas y costo de domicilio",
        estado: "ya",
        modulo: "pedidos_reservas",
      },
      {
        nombre: "Horario de cocina: pedidos solo cuando está abierta",
        estado: "ya",
        modulo: "pedidos_reservas",
        ficha: "horario-de-cocina",
      },
      {
        nombre: "Pedidos programados para otro día u otra hora",
        estado: "ya",
        modulo: "pedidos_programados",
        ficha: "pedidos-programados",
      },
      {
        nombre: "Cliente frecuente: tarjeta de sellos digital",
        estado: "ya",
        modulo: "cliente_frecuente",
        ficha: "cliente-frecuente",
      },
      { nombre: "Sistema de gestión ligero: pedidos del día y caja", estado: "proximo" },
    ],
  },

  {
    slug: "dulceria",
    nombre: "Dulcería, panadería o repostería",
    corto: "Dulcería",
    descripcion:
      "Trabajas por encargo y necesitas fecha, detalles y anticipo en el mismo sitio.",
    pack: {
      nombre: "Encargos sin perder ninguno",
      lema: "Catálogo, apartados y pedidos programados por fecha.",
      modulos: ["pedidos_reservas", "pedidos_programados"],
      completa: [
        "Catálogo con fotos y «Hoy hay»",
        "Pedidos por WhatsApp, apartados y costo de domicilio",
        "Pedidos programados para el día que toca entregar",
      ],
    },
    servicios: [
      {
        nombre: "Catálogo con fotos y «Hoy hay»",
        estado: "ya",
        modulo: "menu_pro",
        ficha: "carta-y-qr",
      },
      {
        nombre: "Pedidos por WhatsApp con dirección",
        estado: "ya",
        modulo: "pedidos_reservas",
        ficha: "flujo-atencion-pedidos",
      },
      { nombre: "Apartados", estado: "ya", modulo: "pedidos_reservas" },
      { nombre: "Zonas y costo de domicilio", estado: "ya", modulo: "pedidos_reservas", ficha: "zonas-domicilio" },
      { nombre: "Pedidos por encargo con detalles y anticipo", estado: "proximo" },
      { nombre: "Calendario de encargos", estado: "proximo" },
      { nombre: "Sistema de gestión: insumos, caja y encargos", estado: "proximo" },
    ],
  },

  {
    slug: "bar",
    nombre: "Bar o club",
    corto: "Bar",
    descripcion:
      "La noche se llena por lo que anuncias. Carta, reservas y eventos en un solo lugar.",
    pack: {
      nombre: "Bar con mesa reservada",
      lema: "Carta QR, reservas con aforo y una publicación semanal.",
      modulos: ["pedidos_reservas", "facebook"],
      completa: [
        "Carta QR con fotos y «Hoy hay»",
        "Reservas de mesa con aforo",
        "Una publicación semanal en grupos de Facebook",
      ],
    },
    servicios: [
      {
        nombre: "Carta QR con fotos y «Hoy hay»",
        estado: "ya",
        modulo: "menu_pro",
        ficha: "carta-y-qr",
      },
      {
        nombre: "Ofertas y novedades",
        estado: "ya",
        modulo: "menu_pro",
        ficha: "ofertas-y-novedades",
      },
      { nombre: "Reservas de mesa con aforo", estado: "ya", modulo: "pedidos_reservas" },
      { nombre: "Eventos y pin destacado", estado: "proximo" },
      { nombre: "Cartelera semanal: música, DJ, karaoke", estado: "proximo" },
      { nombre: "Lista de invitados o entrada reservada", estado: "proximo" },
      { nombre: "Sistema de gestión: caja e inventario de bebidas", estado: "proximo" },
    ],
  },

  {
    slug: "barberia",
    nombre: "Barbería, peluquería o salón de belleza",
    corto: "Barbería",
    descripcion:
      "Tu agenda es el negocio. Citas, servicios con precio y clientes que vuelven.",
    pack: {
      nombre: "Sillón lleno",
      lema: "Citas, carta de servicios y tarjeta de sellos para el que repite.",
      modulos: ["pedidos_reservas", "cliente_frecuente"],
      completa: [
        "Citas y catálogo de servicios con precio y fotos",
        "Tarjeta de sellos digital para clientes de siempre",
        "Carta y QR configurados, sin la marca de La Verde",
      ],
    },
    servicios: [
      { nombre: "Citas", estado: "ya" },
      { nombre: "Catálogo de servicios con precio y fotos", estado: "ya" },
      { nombre: "Avisos a seguidores", estado: "ya", plan: "esencial" },
      { nombre: "Servicios con duración para calcular huecos", estado: "proximo" },
      { nombre: "Agenda por profesional", estado: "proximo" },
      { nombre: "Recordatorio de cita el día antes", estado: "proximo" },
      {
        nombre: "Cliente frecuente: tarjeta de sellos digital",
        estado: "ya",
        modulo: "cliente_frecuente",
        ficha: "cliente-frecuente",
      },
      { nombre: "Galería de trabajos por estilo", estado: "proximo" },
      { nombre: "Cupones por WhatsApp", estado: "proximo" },
    ],
  },

  {
    slug: "hostal",
    nombre: "Renta de habitaciones u hostal",
    corto: "Hostal",
    descripcion:
      "Las noches libres y las ocupadas tienen que estar claras antes de responder.",
    pack: {
      nombre: "Hostal que se llena",
      lema: "Reservas por WhatsApp y presencia en los grupos de tu zona.",
      modulos: ["pedidos_reservas", "facebook"],
      completa: [
        "Ficha con fotos, energía de respaldo y características",
        "Reservas por WhatsApp, ya conectadas a tu ficha",
        "Una publicación semanal en grupos de Facebook",
      ],
    },
    servicios: [
      {
        nombre: "Ficha con fotos, energía de respaldo y características",
        estado: "ya",
      },
      { nombre: "Reservas por WhatsApp", estado: "ya", modulo: "pedidos_reservas" },
      { nombre: "Calendario de disponibilidad", estado: "proximo" },
      { nombre: "Tarifas por temporada y por cantidad de noches", estado: "proximo" },
      { nombre: "Servicios extra: desayuno, traslado, lavandería", estado: "proximo" },
      { nombre: "Gestión de huéspedes: registro, estancias y cobros", estado: "proximo" },
    ],
  },

  {
    slug: "servicios-tecnicos",
    nombre: "Servicios técnicos",
    corto: "Técnicos",
    descripcion:
      "Móviles, electrodomésticos y computadoras: el cliente quiere saber cuánto y cuándo.",
    pack: {
      nombre: "Taller de servicios",
      lema: "Catálogo de servicios, citas y visibilidad en Facebook.",
      modulos: ["pedidos_reservas", "facebook"],
      completa: [
        "Ficha y catálogo de servicios con precios",
        "Citas por WhatsApp conectadas a tu catálogo",
        "Una publicación semanal en grupos de Facebook",
      ],
    },
    servicios: [
      { nombre: "Ficha y catálogo de servicios con precios", estado: "ya" },
      { nombre: "Citas", estado: "ya" },
      { nombre: "Presupuesto rápido por WhatsApp", estado: "proximo" },
      { nombre: "Estado de reparación consultable con un código", estado: "proximo" },
      { nombre: "Garantía registrada con fecha", estado: "proximo" },
      { nombre: "Sistema de gestión: órdenes, piezas y caja", estado: "proximo" },
    ],
  },

  {
    slug: "taller",
    nombre: "Taller mecánico o ponchera",
    corto: "Taller",
    descripcion:
      "El carro entra, se repara y se entrega. Que el dueño pueda seguir el estado sin llamar.",
    pack: {
      nombre: "Taller organizado",
      lema: "Servicios con precio, citas y presencia en Facebook.",
      modulos: ["pedidos_reservas", "facebook"],
      completa: [
        "Ficha, servicios con precios y citas",
        "Citas conectadas a tu catálogo, sin llamadas",
        "Una publicación semanal en grupos de Facebook",
      ],
    },
    servicios: [
      { nombre: "Ficha, servicios con precios y citas", estado: "ya" },
      { nombre: "Presupuesto rápido por WhatsApp", estado: "proximo" },
      { nombre: "Estado de reparación consultable con un código", estado: "proximo" },
      { nombre: "Recordatorio de mantenimiento", estado: "proximo" },
      { nombre: "Sistema de gestión: órdenes, piezas y caja", estado: "proximo" },
    ],
  },

  {
    slug: "ropa",
    nombre: "Tienda de ropa, calzado o accesorios",
    corto: "Ropa",
    descripcion:
      "Mucho producto con talla y color. Lo que se agota hoy vuelve la semana que viene.",
    pack: {
      nombre: "Tienda que vende sola",
      lema: "Catálogo con «Hoy hay», pedidos, apartados y Facebook.",
      modulos: ["pedidos_reservas", "facebook"],
      completa: [
        "Catálogo con fotos y «Hoy hay», productos ilimitados",
        "Pedidos por WhatsApp, apartados y costo de domicilio",
        "Una publicación semanal en grupos de Facebook",
      ],
    },
    servicios: [
      {
        nombre: "Catálogo con fotos y «Hoy hay»",
        estado: "ya",
        modulo: "menu_pro",
        ficha: "carta-y-qr",
      },
      {
        nombre: "Ofertas y novedades",
        estado: "ya",
        modulo: "menu_pro",
        ficha: "ofertas-y-novedades",
      },
      {
        nombre: "Pedidos por WhatsApp con dirección",
        estado: "ya",
        modulo: "pedidos_reservas",
        ficha: "flujo-atencion-pedidos",
      },
      { nombre: "Apartados", estado: "ya", modulo: "pedidos_reservas" },
      { nombre: "Zonas y costo de domicilio", estado: "ya", modulo: "pedidos_reservas", ficha: "zonas-domicilio" },
      { nombre: "Tallas, colores y variantes por producto", estado: "proximo" },
      { nombre: "Apartado con plazo para pagar", estado: "proximo" },
      { nombre: "«Avísame cuando haya» por talla", estado: "proximo" },
      { nombre: "Sistema de gestión: inventario por talla y color", estado: "proximo" },
    ],
  },

  {
    slug: "ferreteria",
    nombre: "Ferretería o materiales de construcción",
    corto: "Ferretería",
    descripcion:
      "El cliente llega con una lista. Que pueda mandarla y recibir el presupuesto.",
    pack: {
      nombre: "Ferretería con pedidos",
      lema: "Catálogo, pedidos con transporte y Facebook.",
      modulos: ["pedidos_reservas", "facebook"],
      completa: [
        "Catálogo con fotos y «Hoy hay»",
        "Pedidos por WhatsApp y costo de transporte por zona",
        "Una publicación semanal en grupos de Facebook",
      ],
    },
    servicios: [
      {
        nombre: "Catálogo con fotos y «Hoy hay»",
        estado: "ya",
        modulo: "menu_pro",
        ficha: "carta-y-qr",
      },
      {
        nombre: "Pedidos por WhatsApp",
        estado: "ya",
        modulo: "pedidos_reservas",
        ficha: "flujo-atencion-pedidos",
      },
      { nombre: "Zonas y costo de transporte", estado: "ya", modulo: "pedidos_reservas" },
      { nombre: "Presupuesto por lista de materiales", estado: "proximo" },
      { nombre: "Lista de precios por mayor", estado: "proximo" },
      { nombre: "«Avísame cuando haya»", estado: "proximo" },
      { nombre: "Sistema de gestión: inventario, caja y crédito", estado: "proximo" },
    ],
  },

  {
    slug: "gimnasio",
    nombre: "Gimnasio, academia o clases",
    corto: "Academia",
    descripcion:
      "Baile, idiomas o deportes: horarios con cupo y alumnos que renuevan el mes.",
    pack: {
      nombre: "Alumnos que vuelven",
      lema: "Inscripciones, carta de clases y tarjeta de sellos.",
      modulos: ["pedidos_reservas", "cliente_frecuente"],
      completa: [
        "Ficha, fotos y citas",
        "Tarjeta de sellos digital para alumnos constantes",
        "Inscripciones y clases conectadas a tu catálogo",
      ],
    },
    servicios: [
      { nombre: "Ficha, fotos y citas", estado: "ya" },
      { nombre: "Avisos a seguidores", estado: "ya", plan: "esencial" },
      { nombre: "Horario de clases con cupos", estado: "proximo" },
      { nombre: "Inscripción a clases por WhatsApp", estado: "proximo" },
      { nombre: "Clase de prueba", estado: "proximo" },
      { nombre: "Membresías: pagos mensuales y asistencia", estado: "proximo" },
    ],
  },

  {
    slug: "transporte",
    nombre: "Transporte, mensajería o taxis",
    corto: "Transporte",
    descripcion:
      "Viajes y envíos que se piden por WhatsApp, con origen y destino ya escritos.",
    pack: {
      nombre: "Transporte que se encuentra",
      lema: "Tu ficha en el mapa, publicaciones en Facebook y asistente.",
      modulos: ["facebook", "asistente_telegram"],
      completa: [
        "Ficha y contacto visibles en el mapa",
        "Una publicación semanal en grupos de Facebook",
        "Carta y servicios editables desde Telegram",
      ],
    },
    servicios: [
      { nombre: "Ficha y contacto", estado: "ya" },
      { nombre: "Tarifas por zona o recorrido", estado: "proximo" },
      { nombre: "Solicitud de viaje o envío por WhatsApp", estado: "proximo" },
      { nombre: "Viajes programados", estado: "proximo" },
      { nombre: "Gestión de viajes: choferes, viajes y cobros", estado: "proximo" },
    ],
  },

  {
    slug: "fotografia",
    nombre: "Fotografía, eventos y decoración",
    corto: "Eventos",
    descripcion:
      "Fechas que se reservan con anticipo y trabajos que hablan solos en un portafolio.",
    pack: {
      nombre: "Agenda de fechas",
      lema: "Reservas, citas y una publicación semanal.",
      modulos: ["pedidos_reservas", "facebook"],
      completa: [
        "Ficha, fotos y citas",
        "Reservas por WhatsApp conectadas a tu ficha",
        "Una publicación semanal en grupos de Facebook",
      ],
    },
    servicios: [
      { nombre: "Ficha, fotos y citas", estado: "ya" },
      { nombre: "Eventos y pin destacado", estado: "proximo" },
      { nombre: "Paquetes con precio según el evento", estado: "proximo" },
      { nombre: "Portafolio por tipo de evento", estado: "proximo" },
      { nombre: "Calendario de fechas ocupadas", estado: "proximo" },
      { nombre: "Reserva de fecha con anticipo", estado: "proximo" },
    ],
  },
];

/** Los packs estándar se enseñan en todas las categorías. */
export const PACKS_ESTANDAR: readonly Pack[] = [
  "esencial",
  "publicidad_max",
  "pro",
];
