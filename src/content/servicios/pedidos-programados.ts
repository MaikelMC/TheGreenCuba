import type { ServicioContent } from "./_tipos";

export const pedidosProgramados: ServicioContent = {
  slug: "pedidos-programados",
  titulo: "Que el cliente elija cuándo le llega",
  nombre: "Pedidos programados",
  descripcionCorta:
    "El cliente pide ahora y elige la franja horaria en que quiere recibir su pedido. Tú organizas la carga antes de que empiece el día.",
  categoria: "comida-a-domicilio",
  precio: { tipo: "modulo", clave: "pedidos_programados" },
  funcion: "pedidos_programados",
  anclaPanel: "/business?seccion=settings",

  tePasaEsto: [
    "Recibes todos los pedidos en la misma hora del mediodía y no das abasto para preparar y entregar todo a tiempo.",
    "Un cliente quiere pedir con anticipación para cuando llega del trabajo, pero no tiene cómo hacerlo sin escribirte y esperar confirmación.",
    "No sabes cuántos pedidos vas a tener hasta que llegan, y eso te impide organizar lo que necesitas preparar con tiempo.",
  ],

  asFunciona: [
    "Defines las franjas horarias en que entregas o tienes lista la recogida: por ejemplo, de 12 a 13, de 13 a 14 y de 14 a 15.",
    "El cliente abre tu carta, elige los productos y antes de enviar el pedido selecciona la franja en que quiere recibirlo.",
    "El mensaje que te llega por WhatsApp incluye el pedido completo y la franja elegida.",
    "Con eso puedes ver de un vistazo cuántos pedidos tienes en cada franja y preparar sin apuros.",
  ],

  loQueIncluye: [
    "Franjas horarias configurables desde el panel: tú decides cuántas y en qué rango de horas.",
    "El cliente elige la franja en el momento de hacer el pedido, antes de enviarlo por WhatsApp.",
    "El pedido llega a tu WhatsApp con la franja incluida, claramente indicada.",
    "Funciona para cualquier tipo de negocio que use el flujo de pedidos: domicilio, recogida o servicios.",
  ],

  loQueNoHace: [
    "No mueve pedidos de una franja a otra automáticamente si se llena. Si una franja se satura, lo gestionas tú respondiendo al cliente.",
    "No limita la cantidad de pedidos por franja: puedes recibir todos los que lleguen en cada una.",
    "No avisa a cocina directamente: el pedido te llega por WhatsApp igual que siempre.",
    "No calcula el tiempo de preparación ni ajusta las franjas según tu carga del momento.",
  ],

  queNecesitas: [
    "El Flujo de atención de pedidos activo. Los pedidos programados se suman a ese flujo.",
  ],

  preguntas: [
    {
      pregunta: "¿Cuántas franjas horarias puedo tener?",
      respuesta:
        "Las que necesites. Puedes poner tres, cinco o las que encajen con tu ritmo de trabajo. Si un día tienes menos capacidad, reduces las franjas desde el panel antes de abrir.",
    },
    {
      pregunta: "¿El cliente puede elegir una hora exacta o solo la franja?",
      respuesta:
        "Solo la franja. Así tú tienes margen para organizar la entrega dentro de ese rango sin comprometerte a un minuto exacto. El cliente sabe que su pedido llegará o estará listo entre las 13 y las 14, por ejemplo.",
    },
    {
      pregunta: "¿Sirve si no hago domicilio y solo tengo recogida en el local?",
      respuesta:
        "Sí. Las franjas funcionan igual para recogida: el cliente elige a qué hora pasará a buscar el pedido y tú lo tienes preparado en ese momento. También sirve para tiendas, panaderías, o cualquier negocio que tome encargos con anticipación.",
    },
    {
      pregunta: "¿Qué pasa si una franja se llena más de lo que puedo atender?",
      respuesta:
        "El sistema no limita automáticamente la cantidad de pedidos por franja. Si ves que una se está llenando demasiado, puedes cerrar los pedidos de ese momento desde el panel usando la pausa manual.",
    },
    {
      pregunta: "¿Puedo usar pedidos programados sin el horario de cocina?",
      respuesta:
        "Sí. El horario de cocina es opcional y sirve para cerrar el botón de pedir fuera de tu horario de atención. Los pedidos programados funcionan aunque no lo tengas configurado.",
    },
  ],

  ejemploTipo: "programados",
};
