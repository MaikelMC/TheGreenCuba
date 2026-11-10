import type { ServicioContent } from "./_tipos";

export const cartaYQr: ServicioContent = {
  slug: "carta-y-qr",
  titulo: "Tu carta en el móvil de tus clientes",
  nombre: "Menú Pro",
  descripcionCorta:
    "Un QR con tu nombre, fotos, productos ilimitados y la opción de marcar lo que hay hoy.",
  categoria: "comida-a-domicilio",
  precio: { tipo: "modulo", clave: "menu_pro" },
  funcion: "hoy_hay",
  anclaPanel: "/business?seccion=catalogo",

  tePasaEsto: [
    "Tus clientes te preguntan por WhatsApp «¿qué tienes hoy?» antes de pedir, y si no contestas rápido, se van a otro.",
    "Tienes un QR en la mesa o en la puerta, pero lleva la marca de La Verde y no el nombre de tu negocio.",
    "Tienes más de 15 platos y la carta gratis te los recorta.",
  ],

  asFunciona: [
    "Activas el Menú Pro y tu carta pasa a ser ilimitada: tantos productos como quieras, con fotos.",
    "Te damos un QR nuevo con el nombre de tu negocio, listo para imprimir como sticker o compartir por WhatsApp.",
    "Cada día marcas lo que está disponible y lo que se agotó. El cliente lo ve en tiempo real antes de pedir.",
    "Si quieres mostrar algo especial —una oferta, un plato nuevo— lo pones en la sección de Ofertas y aparece arriba de todo.",
  ],

  loQueIncluye: [
    "Productos y fotos ilimitados (el plan Gratis tiene un tope de 15).",
    "QR con el nombre de tu negocio, sin la marca de La Verde. Listo para sticker o imagen de WhatsApp.",
    "«Hoy hay»: puedes marcar cada plato como disponible o agotado. El cliente lo ve al abrir la carta.",
    "Sección de Ofertas y Nuevos: hasta 3 activas a la vez, en la parte alta de la carta.",
    "Precios con tasa del día en CUP.",
  ],

  loQueNoHace: [
    "No cobra ni procesa pagos. La venta la cierras tú por WhatsApp o en persona.",
    "No actualiza el «Hoy hay» solo. Eres tú quien lo marca cada día desde el panel.",
    "El QR no cuenta cuántas personas lo escanean; eso está en las estadísticas del plan Gratis.",
    "La sección de Ofertas no avisa a nadie automáticamente. Para que tus seguidores reciban un aviso, necesitas el plan Esencial o superior.",
  ],

  queNecesitas: ["Solo una cuenta de dueño en La Verde. No depende de ningún otro servicio."],

  preguntas: [
    {
      pregunta: "¿Mis clientes tienen que crearse una cuenta o descargar algo?",
      respuesta:
        "No. Abren el enlace o escanean el QR y ya ven la carta. Nada que instalar, nada que registrarse.",
    },
    {
      pregunta: "¿Qué pasa si se va la luz o no tengo datos mientras marco el «Hoy hay»?",
      respuesta:
        "La carta queda como estaba hasta que vuelvas a cambiarla. Si se agotó algo y no puedes marcarlo a tiempo, el cliente puede seguir pidiéndolo, pero ese es el momento de llamarle y explicarle.",
    },
    {
      pregunta: "¿Puedo imprimir el QR yo mismo?",
      respuesta:
        "Sí. Desde el panel puedes descargarlo como imagen y llevarlo a cualquier imprenta, o usarlo como fondo de pantalla, en un grupo de WhatsApp, donde quieras.",
    },
    {
      pregunta: "¿El QR cambia si actualizo la carta?",
      respuesta:
        "No. El QR apunta siempre a la misma dirección de tu carta. Lo que cambia en la carta se ve al abrir ese enlace, sin cambiar el QR.",
    },
    {
      pregunta: "¿Lo puede manejar mi dependienta?",
      respuesta:
        "Sí. Marcar el «Hoy hay» y agregar un producto no requiere permisos especiales. Cualquier persona que tú autorices en el panel puede hacerlo.",
    },
  ],

  ejemploTipo: "carta-qr",
};
