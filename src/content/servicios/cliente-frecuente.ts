import type { ServicioContent } from "./_tipos";

export const clienteFrecuente: ServicioContent = {
  slug: "cliente-frecuente",
  titulo: "El cliente que vuelve, siempre vuelve",
  nombre: "Cliente frecuente",
  descripcionCorta:
    "Una tarjeta de sellos digital que premia a los clientes que repiten. Sin papel, sin perderla, siempre en el móvil.",
  categoria: "comida-a-domicilio",
  precio: { tipo: "modulo", clave: "cliente_frecuente" },
  funcion: "cliente_frecuente",
  anclaPanel: "/business?seccion=clientes",

  tePasaEsto: [
    "Tienes una tarjeta de fidelización en papel pero los clientes la pierden, la olvidan o viene toda arrugada y sin sellos que contar.",
    "Quieres premiar a los clientes que repiten pero no tienes una forma cómoda de llevar la cuenta.",
    "Un cliente que viene hace meses no se siente diferente de uno que entra por primera vez, y eso lo nota.",
  ],

  asFunciona: [
    "Desde el panel creas la tarjeta: cuántos sellos hacen falta para el premio y qué premio es.",
    "El cliente recibe un enlace a su tarjeta con un QR único, que puede guardar en la pantalla de inicio de su móvil.",
    "Cada vez que viene, escanea el QR o lo abres tú desde el panel, y le añades un sello.",
    "Cuando llega al número de sellos que fijaste, canjea el premio. La tarjeta se reinicia y empieza de nuevo.",
  ],

  loQueIncluye: [
    "Tarjeta digital de sellos por cliente, accesible desde cualquier móvil sin app.",
    "Panel de clientes: ves quién tiene cuántos sellos y quién está cerca del premio.",
    "El cliente puede guardar su tarjeta en la pantalla de inicio de su móvil (PWA), como si fuera una app.",
    "Historial de sellos por cliente: cuándo se añadió cada uno y quién lo hizo.",
    "Configuración del premio: tú decides qué es —un producto gratis, un descuento, lo que quieras— y cuántos sellos hacen falta.",
  ],

  loQueNoHace: [
    "No aplica el premio automáticamente. Cuando el cliente llega al tope, te avisa y eres tú quien da el premio en el mostrador.",
    "No envía recordatorios al cliente de cuántos sellos le faltan. Él puede verlo en su tarjeta cuando quiera.",
    "No conecta con un sistema de caja ni descuenta el premio en el cobro. Tú lo gestionas en el momento.",
    "No limita quién puede añadir sellos: cualquier persona que tú autorices en el panel puede hacerlo.",
  ],

  queNecesitas: [
    "El Flujo de atención de pedidos activo, o contratarlo junto a este servicio. La tarjeta de cliente frecuente se apoya en ese módulo.",
  ],

  preguntas: [
    {
      pregunta: "¿El cliente necesita descargar una app?",
      respuesta:
        "No. Su tarjeta es un enlace que puede abrir desde cualquier navegador. Si quiere tenerla siempre a mano, puede guardarla en la pantalla de inicio del móvil con un toque, y funciona como una app aunque no descargue nada.",
    },
    {
      pregunta: "¿Qué pasa si el cliente pierde el enlace a su tarjeta?",
      respuesta:
        "Puede pedírtelo de nuevo. Desde el panel ves a todos tus clientes con tarjeta y puedes reenviarles el enlace en cualquier momento. Los sellos que tenía no se pierden.",
    },
    {
      pregunta: "¿Puedo tener más de una tarjeta con distintos premios?",
      respuesta:
        "Por ahora cada negocio tiene una sola tarjeta activa. Puedes cambiar el número de sellos o el premio desde el panel cuando quieras, pero el cambio aplica a todos los clientes a partir de ese momento.",
    },
    {
      pregunta: "¿Cómo añado un sello?",
      respuesta:
        "Desde el panel buscas al cliente por nombre o número de teléfono y pulsas «Añadir sello». También puedes escanear el QR de la tarjeta del cliente con tu propio móvil y añadirlo desde ahí.",
    },
    {
      pregunta: "¿Puedo ver quién está cerca de completar la tarjeta?",
      respuesta:
        "Sí. El panel de clientes muestra todos los clientes con tarjeta activa, cuántos sellos tiene cada uno y cuántos les faltan para el premio. Así puedes anticiparte cuando alguien está a uno o dos sellos del canje.",
    },
  ],

  ejemploTipo: "cliente-frecuente",
};
