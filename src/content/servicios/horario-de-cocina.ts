import type { ServicioContent } from "./_tipos";

export const horarioDeCocina: ServicioContent = {
  slug: "horario-de-cocina",
  titulo: "Sin pedidos fuera de hora",
  nombre: "Horario de cocina",
  descripcionCorta:
    "Define tu horario de pedidos a domicilio y pausa la cocina con un toque cuando ya no puedes atender más.",
  categoria: "comida-a-domicilio",
  precio: { tipo: "incluido", en: "pedidos_reservas" },
  funcion: "horario_cocina",
  anclaPanel: "/business?seccion=settings",

  tePasaEsto: [
    "Son las 10 de la noche, ya recogiste la cocina, y llega un pedido por WhatsApp. Tienes que explicarle al cliente que ya no atiendes y se molesta.",
    "Los fines de semana abres más tarde pero los pedidos llegan a la misma hora de siempre y no das abasto.",
    "Hay días que la cocina se te llena de trabajo y necesitas parar los pedidos nuevos por un rato, pero no tienes cómo avisarlo sin escribir a cada cliente.",
  ],

  asFunciona: [
    "Desde Ajustes defines tu horario de pedidos: los días y la franja en que atiendes. Fuera de ese horario, el botón de pedido se desactiva solo.",
    "Cuando el horario está cerrado, el cliente ve un aviso en tu carta con el próximo horario de apertura.",
    "Si en medio del horario la cocina se llena o necesitas parar, pulsas el botón de Pausa desde el panel y los pedidos se detienen al instante.",
    "Cuando puedas retomar, vuelves a activarlo y la carta vuelve a aceptar pedidos.",
  ],

  loQueIncluye: [
    "Horario semanal de pedidos: días y franjas horarias. El botón de pedido se activa y desactiva solo.",
    "Pausa manual inmediata desde el panel, para parar pedidos en cualquier momento sin cambiar el horario.",
    "Aviso automático al cliente cuando intenta pedir fuera de hora, con la información del próximo horario.",
    "Incluido sin coste adicional con el Flujo de atención de pedidos.",
  ],

  loQueNoHace: [
    "No avisa a tus clientes habituales cuando vuelves a abrir. Solo muestra el horario en la carta.",
    "No gestiona turnos ni cantidad máxima de pedidos simultáneos: eso lo controlas tú.",
    "No diferencia entre pedidos a domicilio y recogida en el local: el horario aplica a todos los pedidos.",
    "No envía confirmación de reapertura por WhatsApp.",
  ],

  queNecesitas: [
    "El Flujo de atención de pedidos activo. El horario de cocina viene incluido con él.",
  ],

  preguntas: [
    {
      pregunta: "¿Qué ve el cliente si intenta pedir cuando estoy cerrado?",
      respuesta:
        "Ve la carta completa pero el botón de «Pedir» está desactivado con un mensaje que explica que no estás atendiendo pedidos en este momento y cuándo será el próximo horario. No puede enviar el pedido hasta que abras.",
    },
    {
      pregunta: "¿Puedo tener un horario diferente para cada día de la semana?",
      respuesta:
        "Sí. Puedes configurar distintas franjas para cada día: si el lunes abres de 11 a 15 y el viernes de 11 a 22, se configura por separado. También puedes dejar días sin horario si no atiendes ese día.",
    },
    {
      pregunta: "¿La pausa manual cancela los pedidos que ya llegaron?",
      respuesta:
        "No. Los pedidos que ya están en tu WhatsApp siguen ahí. La pausa solo impide que lleguen pedidos nuevos mientras esté activa. Los que ya recibiste los atiendes como siempre.",
    },
    {
      pregunta: "¿Sirve para negocios que no son de comida?",
      respuesta:
        "Sí. Cualquier negocio que use el flujo de pedidos puede configurar su horario de atención. No tiene por qué ser una cocina: una tienda, una peluquería o cualquier servicio puede usarlo para controlar cuándo recibe solicitudes.",
    },
  ],

  ejemploTipo: "horario",
};
