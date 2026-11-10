import type { ServicioContent } from "./_tipos";

export const flujoAtencionPedidos: ServicioContent = {
  slug: "flujo-atencion-pedidos",
  titulo: "El pedido llega listo para atender",
  nombre: "Flujo de atención de pedidos",
  descripcionCorta:
    "El cliente elige de tu carta y te escribe por WhatsApp con el pedido armado: productos, dirección y zona de domicilio.",
  categoria: "comida-a-domicilio",
  precio: { tipo: "modulo", clave: "pedidos_reservas" },
  funcion: "whatsapp_pedido",
  anclaPanel: "/business?seccion=pedidos",

  tePasaEsto: [
    "Un cliente te escribe por WhatsApp «¿qué tienes?», luego «dame dos de eso y uno de lo otro», y entre ir y volver tardas diez minutos en entender qué quiere exactamente.",
    "Anotas pedidos a mano, se te mezclan, y a veces le cobras mal o preparas algo que no era.",
    "Un cliente pide domicilio y no sabes si llega a su zona, o le das el precio de envío de cabeza y luego cambia.",
  ],

  asFunciona: [
    "El cliente abre tu carta desde el QR o el enlace, elige los productos y pulsa «Pedir».",
    "Se abre WhatsApp con un mensaje ya armado: los productos que eligió, las cantidades y el total estimado.",
    "Si tienes zonas de domicilio configuradas, el cliente selecciona su zona antes de enviar y el mensaje incluye el costo de envío correspondiente.",
    "Tú recibes el mensaje en WhatsApp y ya sabes exactamente qué quieren, cuánto es y adónde va. Solo confirmas y preparas.",
  ],

  loQueIncluye: [
    "Botón de pedido en tu carta en línea: el cliente arma el pedido y lo manda por WhatsApp en un clic.",
    "El mensaje incluye los productos, cantidades, precios individuales y total estimado.",
    "Zonas de domicilio: define tus zonas con nombre y precio de envío. El cliente las ve, elige la suya y el mensaje llega con esa información.",
    "Puedes activar también las Reservas: el mismo flujo pero para reservar mesa o turno, con fecha y hora. Es la misma tarifa.",
  ],

  loQueNoHace: [
    "No cobra en línea. El pago lo cierras tú por WhatsApp o en mano.",
    "No genera automáticamente una comanda impresa ni notifica a cocina. Para eso está el Horario de cocina.",
    "No confirma el pedido al cliente: eres tú quien responde por WhatsApp para cerrar.",
    "No calcula el tiempo de entrega ni avisa al cliente cuándo llega su pedido.",
  ],

  queNecesitas: [
    "El Menú Pro activo, o contratarlo junto a este servicio. El flujo de pedidos usa tu carta en línea como base.",
    "Un número de WhatsApp activo donde lleguen los pedidos. Lo configuras en Ajustes del panel.",
  ],

  preguntas: [
    {
      pregunta: "¿El cliente necesita cuenta o app para hacer un pedido?",
      respuesta:
        "No. Abre tu carta desde el QR o el enlace, elige lo que quiere y pulsa el botón. Se abre su WhatsApp con el mensaje listo. Solo necesita tener WhatsApp en el móvil.",
    },
    {
      pregunta: "¿Qué son las zonas de domicilio y para qué sirven?",
      respuesta:
        "Son las áreas de reparto que tú defines. Por ejemplo: «Centro - 50 CUP», «Rpto. Vista Alegre - 100 CUP». El cliente ve las opciones y elige la suya antes de enviar el pedido. Así el precio de envío llega en el mensaje y no hay que negociarlo después.",
    },
    {
      pregunta: "¿Puedo usar el flujo de pedidos aunque no haga domicilio?",
      respuesta:
        "Sí. Si solo haces recogida en el local, activas el flujo sin configurar zonas. El cliente elige los productos y el mensaje llega sin mención a domicilio. También funciona para negocios que no son de comida: tiendas, servicios, cualquier negocio que quiera recibir pedidos o solicitudes ordenadas.",
    },
    {
      pregunta: "¿Qué diferencia hay entre Pedidos y Reservas?",
      respuesta:
        "El flujo de pedidos es para encargar productos: el cliente elige cosas de la carta y manda el detalle. Las Reservas son para reservar un espacio o turno: el cliente elige fecha y hora. Los dos están incluidos en la misma tarifa; puedes activar uno, el otro o los dos desde el panel.",
    },
    {
      pregunta: "¿Puedo ver el historial de pedidos que llegaron?",
      respuesta:
        "El panel guarda un registro de los pedidos recibidos con fecha, productos y zona. No reemplaza tu propio control, pero sirve para consultar si un cliente pregunta por un pedido anterior.",
    },
  ],

  ejemploTipo: "pedidos",
};
