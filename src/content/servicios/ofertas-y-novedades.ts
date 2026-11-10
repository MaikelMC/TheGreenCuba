import type { ServicioContent } from "./_tipos";

export const ofertasYNovedades: ServicioContent = {
  slug: "ofertas-y-novedades",
  titulo: "Lo especial, arriba de todo",
  nombre: "Ofertas y Novedades",
  descripcionCorta:
    "Una sección fija al inicio de tu carta para poner hasta 3 ofertas, platos nuevos o promociones del día.",
  categoria: "comida-a-domicilio",
  precio: { tipo: "incluido", en: "menu_pro" },
  funcion: "ofertas_flash",
  anclaPanel: "/business?seccion=ofertas",

  tePasaEsto: [
    "Tienes una oferta del día pero está enterrada en el medio de la carta y casi nadie la ve.",
    "Llega un producto nuevo y lo publicas en WhatsApp, pero los clientes que abren tu carta directamente no se enteran.",
    "Preparas algo especial para el fin de semana y no tienes forma de destacarlo sin mover toda la carta.",
  ],

  asFunciona: [
    "Desde el panel abres la sección de Ofertas y creas una entrada: le pones nombre, precio y si quieres una foto.",
    "Esa entrada aparece al inicio de tu carta, en una sección separada y visible antes de que el cliente llegue a los platos normales.",
    "Puedes tener hasta 3 activas a la vez. Cuando pase la oferta, la desactivas y desaparece.",
    "Las ofertas no reemplazan a los productos normales: son un complemento que el cliente ve primero.",
  ],

  loQueIncluye: [
    "Sección «Ofertas y Novedades» al inicio de tu carta en línea, visible en el QR y en el enlace directo.",
    "Hasta 3 entradas activas a la vez, con nombre, precio y foto opcional.",
    "Las puedes activar y desactivar cuando quieras, sin borrarlas: quedan guardadas para usarlas otra vez.",
    "Incluido sin coste adicional en el Menú Pro.",
  ],

  loQueNoHace: [
    "No avisa a tus clientes cuando publicas una oferta nueva. Para eso necesitas el plan Esencial o superior, que sí notifica a tus seguidores.",
    "No tiene fecha de caducidad automática: si olvidas desactivarla, sigue visible.",
    "No aplica descuentos automáticos ni cambia el precio del producto original. Es una entrada separada.",
    "No muestra cuántos clientes vieron la oferta; eso está en las estadísticas del plan de visibilidad.",
  ],

  queNecesitas: [
    "Tener el Menú Pro activo. Las Ofertas y Novedades vienen incluidas con él.",
  ],

  preguntas: [
    {
      pregunta: "¿Las ofertas reemplazan los productos que ya tengo en la carta?",
      respuesta:
        "No. Son una sección aparte. Tus productos normales siguen donde están. Las ofertas aparecen arriba, como una vitrina, y el cliente puede seguir viendo el resto de la carta debajo.",
    },
    {
      pregunta: "¿Puedo usar esta sección para anunciar un plato nuevo aunque no sea una oferta con descuento?",
      respuesta:
        "Sí. La sección se llama «Ofertas y Novedades» precisamente para los dos casos: algo con precio especial o algo que acabas de agregar. Muchos negocios la usan para destacar el plato del día o el especial de la semana.",
    },
    {
      pregunta: "¿Qué pasa con las ofertas que desactivo? ¿Las pierdo?",
      respuesta:
        "No. Quedan guardadas en el panel y puedes volver a activarlas cuando quieras. Si tienes una oferta de cada viernes, la creas una vez y la activas y desactivas cada semana sin escribir nada nuevo.",
    },
    {
      pregunta: "¿Cómo aviso a mis clientes que tengo una oferta?",
      respuesta:
        "Puedes compartir el enlace de tu carta por WhatsApp y contarles que hay algo nuevo. Si quieres que La Verde envíe ese aviso automáticamente a los clientes que siguen tu negocio, necesitas el plan Esencial o superior.",
    },
  ],

  ejemploTipo: "ofertas",
};
