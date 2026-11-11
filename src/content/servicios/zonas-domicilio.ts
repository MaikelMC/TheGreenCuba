import type { ServicioContent } from "./_tipos";

export const zonasDomicilio: ServicioContent = {
  slug: "zonas-domicilio",
  titulo: "El cliente sabe cuánto cuesta el domicilio antes de pedir",
  nombre: "Zonas y costo de domicilio",
  descripcionCorta:
    "Define tus zonas de reparto con el precio de envío de cada una. El cliente la elige antes de enviar el pedido y el costo llega en el mensaje, sin que tengas que explicarlo.",
  categoria: "comida-a-domicilio",
  precio: { tipo: "incluido", en: "pedidos_reservas" },
  funcion: "zonas_domicilio",
  anclaPanel: "/business?seccion=pedidos",

  tePasaEsto: [
    "Un cliente te pregunta cuánto cuesta el domicilio a su barrio, le dices un precio, y cuando llega el momento del pago ya no recuerda lo que acordaron.",
    "Das el mismo precio de envío a todos porque no quieres complicarte, pero a veces pierdes dinero en los que viven lejos.",
    "Un cliente pide domicilio y no sabes si llegas a su zona. Le dices que sí, luego te complica y tienes que cancelar.",
  ],

  asFunciona: [
    "Desde el panel creas tus zonas de reparto: le pones nombre y precio de envío a cada una. Por ejemplo: «Centro - 50 CUP», «Rpto. Vista Alegre - 100 CUP», «Fuera de zona - no llego».",
    "Cuando un cliente hace un pedido desde tu carta, ve la lista de zonas antes de enviar el mensaje. Elige la suya.",
    "El mensaje que llega a tu WhatsApp incluye la zona elegida y el costo de envío ya calculado. Nada que aclarar.",
    "Si un cliente está fuera de tus zonas, lo ve antes de pedir y puede contactarte por otra vía o no molestarte.",
  ],

  loQueIncluye: [
    "Zonas ilimitadas: puedes crear todas las que necesites, con nombre y precio libre.",
    "El precio de envío aparece en el resumen del pedido antes de que el cliente envíe el mensaje.",
    "El mensaje que recibes en WhatsApp incluye la zona y el costo seleccionado.",
    "Puedes activar una opción de «recogida en el local» sin costo, para clientes que prefieren venir.",
    "Incluido en el módulo Reservas y pedidos, sin costo adicional.",
  ],

  loQueNoHace: [
    "No calcula la distancia real en kilómetros. Las zonas las defines tú por barrio, municipio o como te sea útil.",
    "No cobra el envío en línea. El costo llega informado en el mensaje; el pago lo cierras tú.",
    "No rastrea al mensajero ni avisa al cliente cuándo llega el pedido.",
    "No restringe automáticamente pedidos fuera de zona: si no quieres atender una zona, simplemente no la incluyas.",
  ],

  queNecesitas: [
    "El módulo Reservas y pedidos activo. Las zonas de domicilio son parte de ese módulo.",
    "Tener al menos una zona configurada en el panel antes de que el flujo de pedidos la muestre al cliente.",
  ],

  preguntas: [
    {
      pregunta: "¿Cuántas zonas puedo crear?",
      respuesta:
        "Las que necesites. No hay límite. Puedes tener zonas por barrio, por municipio, por distancia o como más te convenga para tu negocio.",
    },
    {
      pregunta: "¿Puedo tener una opción de recogida en el local sin costo de envío?",
      respuesta:
        "Sí. Puedes añadir una zona llamada «Recogida en el local» con precio 0 y aparece entre las opciones. El cliente la elige y el mensaje llega sin costo de envío.",
    },
    {
      pregunta: "¿Qué pasa si un cliente no está en ninguna de mis zonas?",
      respuesta:
        "Solo ve las zonas que tú creaste. Si no hay ninguna que le quede cerca, no puede seleccionar una zona ficticia. Puede escribirte directamente por WhatsApp para acordar si llegas o no.",
    },
    {
      pregunta: "¿Puedo cambiar los precios de las zonas después?",
      respuesta:
        "Sí, en cualquier momento desde el panel. El cambio aplica a partir del próximo pedido; los mensajes que ya llegaron no se modifican.",
    },
  ],

  ejemploTipo: "pedidos",
};
