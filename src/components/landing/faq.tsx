import { ChevronDown } from "lucide-react";
import { Reveal } from "./reveal";

/**
 * Las dudas que frenan a un dueño antes de dar de alta su negocio.
 *
 * Van en la portada, justo antes del cierre: quitan el miedo («¿mis clientes
 * tienen que instalar algo?», «¿funciona sin WiFi?») en el momento en que la
 * persona ya vio los planes y está decidiendo. Las respuestas solo afirman lo
 * que el producto hace de verdad.
 *
 * Mismo acordeón que la ficha de servicios (`<details>` nativo): sin JavaScript
 * propio, accesible con teclado y abre uno sin cerrar los demás.
 */
const PREGUNTAS: { pregunta: string; respuesta: string }[] = [
  {
    pregunta: "¿Mis clientes tienen que instalar una app?",
    respuesta:
      "No. Abren tu carta desde un enlace o escaneando el QR, en el navegador del móvil. Si quieren tenerla a mano, la guardan en la pantalla de inicio y la ven hasta sin datos.",
  },
  {
    pregunta: "¿Funciona si mi negocio no tiene WiFi?",
    respuesta:
      "Sí. Tú editas desde tu móvil con tus datos y tus clientes abren la carta desde los suyos. Todo es ligero a propósito, pensado para datos móviles caros y conexión floja.",
  },
  {
    pregunta: "No sé mucho de tecnología, ¿es complicado?",
    respuesta:
      "Rellenas tu ficha en un par de minutos y ya apareces. Y si te atascas, el asistente de Telegram te edita el menú por ti, sin entrar al panel.",
  },
  {
    pregunta: "¿Cómo me encuentran los clientes?",
    respuesta:
      "Apareces en el mapa de La Verde y en las búsquedas con IA, con tu dirección, tu horario y las monedas que aceptas. La gente busca con sus palabras y te encuentra.",
  },
  {
    pregunta: "¿Cuánto cuesta y puedo cambiar de plan?",
    respuesta:
      "Hay un plan gratis para empezar. Los de pago se cobran por mes y cambias o cancelas cuando quieras, sin ataduras.",
  },
  {
    pregunta: "¿Puedo recibir pedidos y reservas?",
    respuesta:
      "Sí. Recibes pedidos y reservas por WhatsApp, ya conectados a tu catálogo, con la dirección del cliente y el costo del domicilio calculado.",
  },
];

export function FAQ() {
  return (
    <section id="preguntas" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-container px-gutter md:px-gutter-lg">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal
            as="h2"
            text="Las dudas de siempre, resueltas."
            accent="resueltas"
            className="font-lv-display text-[clamp(30px,4.5vw,48px)] font-bold leading-[1.05] tracking-[-0.03em] text-ink text-balance"
          />
          <p className="mt-4 text-base leading-relaxed text-ink-soft/75 text-pretty">
            Lo que todo dueño pregunta antes de empezar. Si te queda otra, te
            respondemos por WhatsApp.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {PREGUNTAS.map((p, i) => (
            <details
              key={i}
              className="group rounded-3xl border border-ink/10 bg-white px-5 py-4 shadow-soft transition-colors duration-300 open:border-verde-300/70 sm:px-6"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-lv-display text-base font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                {p.pregunta}
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-ink/10 text-ink-soft/60 transition-colors duration-300 group-open:border-verde-300 group-open:bg-verde-50 group-open:text-verde-600">
                  <ChevronDown
                    size={16}
                    className="transition-transform duration-300 ease-outquint group-open:rotate-180"
                    aria-hidden
                  />
                </span>
              </summary>
              <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-ink-soft/75 motion-safe:animate-fade-in">
                {p.respuesta}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
