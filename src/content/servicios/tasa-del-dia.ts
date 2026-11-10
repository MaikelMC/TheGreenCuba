import type { ServicioContent } from "./_tipos";

export const tasaDelDia: ServicioContent = {
  slug: "tasa-del-dia",
  titulo: "El precio en CUP, siempre al día",
  nombre: "Tasa del día",
  descripcionCorta:
    "Pon tus precios en USD una sola vez y la carta muestra el equivalente en CUP actualizado cada día.",
  categoria: "comida-a-domicilio",
  precio: { tipo: "incluido", en: "menu_pro" },
  funcion: "tasa_del_dia",
  anclaPanel: "/business?seccion=settings",

  tePasaEsto: [
    "Cambias el precio en CUP cada dos días porque la tasa sube y baja, y aun así algún cliente te discute el precio.",
    "Tienes los precios en la carta en CUP, pero los calculas tú a mano con la tasa del día y a veces te equivocas.",
    "Un cliente ve tu carta a las 11 de la noche con un precio, y al día siguiente te dice que cobras de más.",
  ],

  asFunciona: [
    "Pones el precio de cada producto en USD —el precio real de tu negocio— y lo dejas fijo.",
    "La Verde actualiza la tasa del día cada mañana desde una fuente pública de referencia.",
    "El cliente abre tu carta y ve los precios en CUP calculados con esa tasa, en ese momento.",
    "Si la tasa cambia, el precio en CUP cambia solo. Tú no tocas nada.",
  ],

  loQueIncluye: [
    "Conversión automática de USD a CUP en toda tu carta, visible para el cliente.",
    "Actualización diaria de la tasa de referencia, sin que tú hagas nada.",
    "La tasa del día mostrada al pie de tu carta, para que el cliente sepa a qué tasa está viendo los precios.",
    "Incluido sin coste adicional en el Menú Pro.",
  ],

  loQueNoHace: [
    "No cobra ni convierte dinero real. Solo muestra precios de referencia en CUP.",
    "No usa la tasa informal de la calle ni la del mercado negro: usa una tasa de referencia pública.",
    "No actualiza los precios que pusiste en USD; eso lo haces tú cuando cambias tu costo real.",
    "No avisa al cliente si la tasa cambió desde que vio la carta por última vez.",
  ],

  queNecesitas: [
    "Tener el Menú Pro activo. La tasa del día viene incluida con él.",
  ],

  preguntas: [
    {
      pregunta: "¿Qué tasa usa La Verde?",
      respuesta:
        "Una tasa de referencia pública que se actualiza cada día. No es la tasa del mercado informal, pero se acerca a la que se usa en la práctica. Si tu negocio maneja una tasa distinta, puedes ponérsela encima a tus precios en USD antes de publicarlos.",
    },
    {
      pregunta: "¿Qué pasa si la tasa del día que usa La Verde no es la que yo cobro?",
      respuesta:
        "El cliente ve una referencia; el precio final lo cierras tú. Puedes dejar una nota en tu carta —por ejemplo en la descripción de tus productos— diciendo «los precios se confirman al pedir». Lo que sí te ahorra es el trabajo de recalcular cada producto tú solo cada vez.",
    },
    {
      pregunta: "¿Puedo seguir poniendo los precios en CUP fijos si prefiero?",
      respuesta:
        "Sí. La conversión es opcional: si prefieres poner el precio directamente en CUP y actualizarlo a mano cuando la tasa cambia, puedes hacerlo. La función de tasa del día solo se activa si pones el precio en USD.",
    },
    {
      pregunta: "¿A qué hora se actualiza la tasa?",
      respuesta:
        "Por la mañana, antes de las 9. Si la tasa no está disponible ese día, La Verde mantiene la del día anterior hasta que haya una nueva.",
    },
  ],

  ejemploTipo: "tasa",
};
