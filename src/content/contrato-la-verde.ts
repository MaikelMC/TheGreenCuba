import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/lib/legal";

/**
 * El apartado legal del contrato de La Verde.
 *
 * Es el mismo texto del documento que se entrega al cliente, separado por
 * secciones para poder pintarlo en pantalla y dentro de la descarga. Los
 * huecos que dependen de la contratación concreta —negocio, titular, precio,
 * fechas— no viven aquí: se completan con `DatosContrato`.
 *
 * `{{DIAS}}` y `{{HORARIO}}` son los únicos datos de La Verde que todavía no
 * están fijados; se sustituyen con lo que se escriba en el formulario.
 */
export interface BloqueContrato {
  titulo?: string;
  parrafos?: string[];
  puntos?: string[];
  subsecciones?: BloqueContrato[];
}

export const CONTRATO_TITULO =
  "Guía de bienvenida, servicio y compromiso con nuestros clientes";

export const CONTRATO_INTRO: string[] = [
  "Gracias por confiar en La Verde.",
  "Nos alegra que hayas decidido contar con nosotros para impulsar tu negocio. En La Verde creemos que la tecnología debe resolver problemas reales, facilitar el trabajo diario y ayudar a los negocios a crecer. Por eso, nuestro compromiso no termina cuando contratas un servicio: queremos acompañarte, conocer cómo evoluciona tu negocio y ayudarte a sacar el máximo provecho de las herramientas que ponemos a tu disposición.",
  "Este documento explica quiénes somos, cómo trabajamos, cuáles son nuestros compromisos y qué esperamos de ti como cliente. Queremos que desde el primer día tengas claridad sobre nuestra relación comercial.",
];

export const CONTRATO_SECCIONES: BloqueContrato[] = [
  {
    titulo: "1. ¿Quiénes somos?",
    parrafos: [
      "La Verde es una plataforma tecnológica creada para conectar personas con negocios y ayudar a estos últimos a mejorar su funcionamiento y alcance.",
      "Por una parte, facilitamos que las personas encuentren productos y servicios en Cuba mediante búsquedas inteligentes adaptadas a sus necesidades. Por otra, ofrecemos soluciones tecnológicas a negocios, mipymes y establecimientos comerciales para mejorar su visibilidad, organización y gestión.",
      "No creemos en vender herramientas porque sí. Cada negocio tiene necesidades, procesos y formas de trabajar diferentes. Por eso, estudiamos cada caso y proponemos soluciones que realmente tengan utilidad para su actividad.",
      "Nuestro objetivo es convertirnos en un aliado tecnológico de tu negocio.",
    ],
  },
  {
    titulo: "2. ¿Qué estás contratando?",
    parrafos: [
      "Los servicios de La Verde se organizan según la categoría y las necesidades de cada negocio. Dependiendo de tu actividad, puedes contratar soluciones como:",
    ],
    puntos: [
      "Presencia y visibilidad de tu negocio en el mapa de La Verde.",
      "Ficha digital con información, fotografías, contactos, ubicación y otros datos relevantes.",
      "Herramientas para facilitar la comunicación con tus clientes.",
      "Sistemas de gestión de ventas, inventario y caja.",
      "Soluciones de organización y control de operaciones.",
      "Otros servicios y módulos tecnológicos disponibles para tu categoría.",
    ],
    subsecciones: [
      {
        parrafos: [
          "Tu propuesta comercial o contrato individual detallará exactamente cuáles son los servicios incluidos, sus funcionalidades, el precio, los plazos y las condiciones particulares.",
          "Importante: contratar un pack no significa contratar todas las herramientas de La Verde. Solo se incluirán los servicios acordados contigo.",
          "Los módulos adicionales podrán contratarse por separado. Cuando formen parte de un pack, podrán disfrutar de las condiciones o descuentos indicados en tu propuesta.",
        ],
      },
    ],
  },
  {
    titulo: "3. Nuestro compromiso contigo",
    parrafos: ["Al contratar nuestros servicios, La Verde se compromete a:"],
    puntos: [
      "Cumplir lo acordado: proporcionar los servicios y funcionalidades descritos en tu propuesta comercial.",
      "Trabajar con transparencia: informarte sobre precios, condiciones, limitaciones y cualquier cambio que pueda afectar el servicio.",
      "Ofrecer atención: recibir tus consultas, incidencias y solicitudes mediante nuestros canales oficiales.",
      "Dar seguimiento: mantener comunicación contigo para conocer cómo está funcionando la solución y detectar oportunidades de mejora.",
      "Proteger tu información: gestionar los datos a los que tengamos acceso con responsabilidad y utilizarlos únicamente para los fines relacionados con los servicios contratados y los autorizados.",
      "Mejorar continuamente: evaluar el funcionamiento de nuestras herramientas y trabajar en las mejoras que correspondan.",
      "Respetar tu negocio: no publicar cambios relevantes en la información comercial que administramos sin la autorización correspondiente.",
    ],
    subsecciones: [
      {
        parrafos: [
          "Nuestro compromiso es ofrecerte soluciones útiles y un servicio responsable, no prometer resultados comerciales que dependen de múltiples factores.",
        ],
      },
    ],
  },
  {
    titulo: "4. Tus responsabilidades como cliente",
    parrafos: [
      "Para que podamos trabajar correctamente, necesitamos también tu colaboración. Como cliente de La Verde, te comprometes a:",
    ],
    puntos: [
      "Proporcionar información veraz y actualizada sobre tu negocio.",
      "Facilitar fotografías, precios, horarios, productos, servicios y demás materiales necesarios para prestar el servicio.",
      "Revisar y confirmar la información que se publicará o configurará en tu nombre.",
      "Realizar los pagos en las fechas y condiciones acordadas.",
      "Utilizar las herramientas contratadas de forma adecuada y legal.",
      "Mantener protegidas tus credenciales y controlar quién tiene acceso a las cuentas y sistemas de tu negocio.",
      "Informarnos oportunamente cuando detectes errores, incidencias o cambios en tus operaciones.",
      "Designar una persona de contacto autorizada para coordinar el trabajo con La Verde.",
    ],
    subsecciones: [
      {
        parrafos: [
          "La calidad y actualización de los resultados también dependen de la información que nos proporciones y de tu participación en el proceso.",
        ],
      },
    ],
  },
  {
    titulo: "5. Pagos y condiciones comerciales",
    parrafos: [
      "Todos los servicios contratados tendrán un precio previamente informado.",
      "Antes de comenzar, deberás conocer:",
    ],
    puntos: [
      "Los servicios incluidos en tu pack.",
      "El precio correspondiente.",
      "La moneda y el método de pago.",
      "La periodicidad de los pagos.",
      "Los posibles costos de instalación, configuración o implementación.",
      "Los servicios adicionales que puedan generar cargos independientes.",
    ],
    subsecciones: [
      {
        titulo: "Promoción de bienvenida 2×1",
        parrafos: [
          "Cuando la promoción esté incluida en tu propuesta comercial, se aplicará de la siguiente manera: contratas el primer mes y recibes el segundo mes sin costo por los servicios recurrentes incluidos en la promoción.",
          "Las condiciones específicas serán las siguientes:",
        ],
        puntos: [
          "El primer mes debe pagarse para activar la promoción.",
          "El segundo mes se ofrecerá sin costo por los servicios recurrentes elegibles.",
          "La promoción no se convierte en dinero, saldo ni crédito reembolsable.",
          "Los servicios de implementación, configuraciones especiales, desarrollos personalizados, licencias o costos de terceros no estarán incluidos, salvo que la propuesta indique expresamente lo contrario.",
          "Cualquier condición adicional deberá aparecer en la oferta comercial aceptada por el cliente.",
        ],
      },
      {
        parrafos: [
          "La duración y el precio de los servicios posteriores a la promoción también deben quedar claros desde el inicio.",
        ],
      },
    ],
  },
  {
    titulo: "6. Política de reembolso",
    parrafos: [
      "Queremos que conozcas desde el principio cómo se gestionan los pagos y qué ocurre cuando un servicio no puede prestarse según lo acordado.",
      "Nuestra política propuesta es la siguiente:",
    ],
    puntos: [
      "Antes de comenzar el trabajo: si solicitas cancelar un servicio antes de que La Verde haya iniciado su ejecución o configuración, se evaluará la devolución del importe abonado, descontando únicamente los costos previamente informados y no recuperables que correspondan.",
      "Una vez iniciado el trabajo: no se devolverán automáticamente los importes correspondientes a trabajos ya realizados, servicios prestados, configuraciones completadas o gastos de terceros que hayan sido previamente informados y autorizados.",
      "Cuando La Verde no pueda cumplir: si por una causa atribuible a La Verde no podemos proporcionar una parte sustancial del servicio contratado, buscaremos primero una solución. Cuando no sea posible resolver el incumplimiento, se evaluará una devolución proporcional por la parte del servicio no prestada o una compensación acordada.",
      "Pagos duplicados o errores de facturación: cuando se compruebe un cobro duplicado o incorrecto, se realizará la devolución o corrección correspondiente.",
      "Servicios por mensualidad: una vez iniciado y puesto a disposición el período contratado, no se devolverán automáticamente los importes por días no utilizados debido a una decisión unilateral del cliente.",
    ],
    subsecciones: [
      {
        parrafos: [
          "Todas las solicitudes deberán comunicarse por los canales oficiales de La Verde, indicando el servicio, el motivo y la información necesaria para revisar el caso. Cada solicitud será evaluada individualmente y recibirá una respuesta por un canal oficial.",
        ],
      },
    ],
  },
  {
    titulo: "7. Política de cancelación",
    parrafos: [
      "Puedes solicitar la cancelación de los servicios contratados cuando decidas dejar de utilizarlos, respetando las condiciones particulares de tu contrato.",
      "Para hacerlo:",
    ],
    puntos: [
      "Debes comunicar tu decisión a través de uno de nuestros canales oficiales.",
      "Debes identificar el negocio y los servicios que deseas cancelar.",
      "La Verde confirmará la recepción y te informará la fecha efectiva de finalización.",
      "Se revisarán los pagos pendientes y cualquier compromiso vigente.",
    ],
    subsecciones: [
      {
        parrafos: [
          "Como condición general propuesta para los servicios mensuales, solicitamos que la cancelación se comunique con al menos 7 días naturales de anticipación a la siguiente fecha de renovación. Si la solicitud llega fuera de ese plazo, la cancelación podrá hacerse efectiva al finalizar el siguiente período facturado.",
          "La cancelación no elimina las obligaciones de pago que ya se hayan generado. Los contratos con una duración mínima, trabajos personalizados o condiciones especiales se regirán por lo expresamente acordado en ellos.",
          "La Verde también podrá suspender o finalizar un servicio ante incumplimientos graves, uso indebido de las herramientas, actividades ilegales o falta de pago, previa comunicación cuando las circunstancias lo permitan.",
        ],
      },
      {
        titulo: "¿Qué ocurre con tu información al finalizar?",
        parrafos: ["Al concluir la relación comercial:"],
        puntos: [
          "Se detendrán los servicios cuya contratación haya finalizado.",
          "Se revisarán los accesos y permisos concedidos.",
          "Podrás solicitar la información de tu negocio que corresponda entregarte, siempre que sea técnicamente posible y no esté sujeta a restricciones de terceros.",
          "Los datos se conservarán o eliminarán de acuerdo con las obligaciones aplicables y las condiciones de privacidad del servicio.",
        ],
      },
      {
        parrafos: [
          "La finalización de un servicio no implica que La Verde pueda apropiarse de la información comercial que pertenece a tu negocio.",
        ],
      },
    ],
  },
  {
    titulo: "8. Soporte y atención al cliente",
    parrafos: [
      "Sabemos que cuando una herramienta forma parte del funcionamiento de un negocio, recibir ayuda a tiempo es importante.",
      "Por eso, los clientes de La Verde dispondrán de atención para:",
    ],
    puntos: [
      "Resolver dudas sobre los servicios contratados.",
      "Reportar errores o problemas técnicos.",
      "Solicitar orientación sobre el uso de las herramientas.",
      "Comunicar cambios en la información de su negocio.",
      "Consultar sobre funcionalidades y servicios adicionales.",
      "Realizar solicitudes administrativas relacionadas con su contrato.",
    ],
    subsecciones: [
      {
        titulo: "¿Cuándo recibirás atención?",
        parrafos: [
          "Nuestro horario ordinario de atención será:",
          "Días: {{DIAS}}",
          "Horario: {{HORARIO}}",
          "Como objetivo de atención, procuraremos ofrecer una primera respuesta dentro de un día hábil.",
          "El tiempo de resolución dependerá de la naturaleza y complejidad de cada solicitud. Una incidencia que requiera investigación técnica o intervención de terceros puede necesitar más tiempo.",
          "Los servicios de soporte ordinario no implican disponibilidad técnica permanente las 24 horas, salvo que se haya acordado expresamente.",
        ],
      },
      {
        titulo: "¿Cómo reportar una incidencia?",
        parrafos: ["Cuando nos contactes, procura incluir:"],
        puntos: [
          "Nombre del negocio.",
          "Servicio afectado.",
          "Descripción del problema.",
          "Captura de pantalla o evidencia, cuando sea posible.",
          "Momento aproximado en que ocurrió.",
        ],
      },
      {
        parrafos: [
          "Esto nos permitirá comprender mejor la situación y atenderla con mayor eficacia.",
        ],
      },
    ],
  },
  {
    titulo: "9. ¿Cómo daremos seguimiento a tu negocio?",
    parrafos: [
      "Para nosotros, la relación con un cliente no debe limitarse a cobrar una mensualidad y mantener una herramienta disponible.",
      "Queremos conocer si las soluciones contratadas están aportando valor y si continúan respondiendo a las necesidades de tu negocio. Por eso, trabajaremos mediante un proceso de seguimiento.",
    ],
    subsecciones: [
      {
        titulo: "Etapa 1. Incorporación y configuración",
        parrafos: [
          "Al iniciar el servicio, coordinaremos contigo la información y los recursos necesarios. En esta etapa podremos:",
        ],
        puntos: [
          "Confirmar los servicios contratados.",
          "Recopilar la información de tu negocio.",
          "Configurar las herramientas correspondientes.",
          "Explicarte cómo utilizarlas.",
          "Identificar a las personas autorizadas para administrarlas.",
        ],
      },
      {
        titulo: "Etapa 2. Primera revisión",
        parrafos: [
          "Durante los primeros días de utilización, nos pondremos en contacto contigo para conocer cómo ha sido la experiencia inicial. Buscaremos identificar dificultades, dudas, errores de configuración o aspectos que puedan mejorarse.",
        ],
      },
      {
        titulo: "Etapa 3. Seguimiento periódico",
        parrafos: [
          "Durante la vigencia del contrato mantendremos comunicación contigo para revisar el funcionamiento de los servicios. Según el tipo de pack contratado, podremos realizar:",
        ],
        puntos: [
          "Revisiones de la información publicada.",
          "Comprobaciones del funcionamiento de las herramientas.",
          "Revisión de métricas disponibles.",
          "Identificación de dificultades operativas.",
          "Recomendaciones de mejora.",
          "Evaluación de nuevas necesidades del negocio.",
        ],
      },
      {
        titulo: "Etapa 4. Evolución y mejoras",
        parrafos: [
          "Los negocios cambian, crecen y adquieren nuevas necesidades. Cuando detectemos oportunidades de mejora, podremos proponerte ajustes o servicios adicionales que tengan sentido para tu actividad.",
          "Ningún servicio adicional de pago se incorporará sin tu conocimiento y aprobación.",
          "La frecuencia y el alcance del seguimiento dependerán de los servicios contratados y de lo indicado en tu propuesta.",
        ],
      },
    ],
  },
  {
    titulo: "10. Nuestros canales oficiales de comunicación",
    parrafos: [
      "Para proteger tu información y garantizar que recibas atención de personas autorizadas, La Verde utilizará exclusivamente sus canales oficiales. Los canales públicos oficiales son:",
    ],
    puntos: ["Sitio web: https://laverde.kynari.dev", "Instagram: @laverdecuba"],
    subsecciones: [
      {
        parrafos: [
          "Para la comunicación directa con clientes, soporte, solicitudes de cancelación y asuntos relacionados con pagos se habilitan los siguientes medios:",
        ],
        puntos: [
          `WhatsApp oficial de atención: ${SUPPORT_WHATSAPP}.`,
          `Correo oficial de atención: ${SUPPORT_EMAIL}.`,
        ],
      },
      {
        parrafos: [
          "El perfil de Instagram se utilizará principalmente para comunicación pública, novedades y contenido de La Verde. No recomendamos enviar contraseñas, datos sensibles o información privada del negocio mediante mensajes públicos o redes sociales.",
          "No consideres oficiales las solicitudes de pago, transferencias, entrega de credenciales o modificaciones contractuales realizadas desde números personales, perfiles desconocidos o cuentas no verificadas de La Verde.",
          "Ante cualquier duda sobre la autenticidad de una comunicación, confirma la información a través de uno de los medios oficiales anteriores.",
        ],
      },
    ],
  },
  {
    titulo: "11. Disponibilidad y limitaciones del servicio",
    parrafos: [
      "La Verde trabaja continuamente para ofrecer herramientas estables y funcionales. Sin embargo, algunos servicios pueden depender de factores externos, como:",
    ],
    puntos: [
      "Conexión a Internet.",
      "Disponibilidad del proveedor de alojamiento.",
      "Servicios tecnológicos de terceros.",
      "Sistemas de pago externos.",
      "Dispositivos y navegadores utilizados.",
      "Condiciones técnicas de los equipos del cliente.",
    ],
    subsecciones: [
      {
        parrafos: [
          "En consecuencia, pueden producirse interrupciones, mantenimientos o limitaciones que escapen a nuestro control directo. Cuando una incidencia relevante afecte a los servicios contratados, procuraremos comunicarla y trabajar en su solución.",
          "La presencia de un negocio en La Verde y el uso de herramientas tecnológicas pueden ayudar a mejorar su visibilidad y organización, pero no garantizan un número determinado de clientes, ventas, ingresos o resultados comerciales.",
        ],
      },
    ],
  },
  {
    titulo: "12. Privacidad y manejo de la información",
    parrafos: [
      "La información de tu negocio es importante y debemos tratarla responsablemente. La Verde se compromete a:",
    ],
    puntos: [
      "Utilizar la información proporcionada para prestar los servicios contratados.",
      "Limitar el acceso a los datos a las personas autorizadas que necesiten utilizarlos para realizar su trabajo.",
      "No divulgar información comercial privada sin autorización, salvo cuando exista una obligación legítima que lo requiera.",
      "Aplicar medidas razonables para proteger la información y los accesos.",
      "Informar sobre situaciones relevantes que puedan comprometer la seguridad de los servicios.",
    ],
    subsecciones: [
      {
        parrafos: [
          "Por tu parte, debes proteger tus contraseñas, revisar los permisos de tus empleados y notificarnos cualquier sospecha de acceso no autorizado.",
          "La información comercial pública, como horarios, ubicación, productos y fotografías, podrá mostrarse en La Verde de acuerdo con las condiciones del servicio contratado y las autorizaciones correspondientes.",
        ],
      },
    ],
  },
  {
    titulo: "13. Modificaciones y nuevas funcionalidades",
    parrafos: [
      "La Verde evoluciona continuamente. Podremos incorporar mejoras, corregir errores y desarrollar nuevas funcionalidades en nuestros productos.",
      "Cuando una modificación afecte de manera significativa a los servicios que has contratado o a sus condiciones comerciales, te comunicaremos la información correspondiente.",
      "Las nuevas funcionalidades que representen servicios de pago independientes no se activarán como cargos adicionales sin tu autorización.",
    ],
  },
  {
    titulo: "14. Una relación basada en la confianza",
    parrafos: [
      "Queremos que tengas la tranquilidad de saber qué estás contratando y quién está detrás del servicio.",
      "Para nosotros, cada negocio representa una realidad diferente. Por eso, escuchamos, analizamos y buscamos soluciones que tengan sentido para su actividad.",
      "No queremos que La Verde sea simplemente otra herramienta que contrates y termines dejando de utilizar. Queremos que sea una parte útil de la evolución de tu negocio.",
      "Gracias por permitirnos acompañarte.",
    ],
  },
];
