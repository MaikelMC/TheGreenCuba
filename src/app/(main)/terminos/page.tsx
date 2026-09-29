import type { Metadata } from "next";
import Link from "next/link";
import {
  DATA_CONTROLLER,
  SUPPORT_EMAIL,
  TERMS_UPDATED_LABEL,
  TERMS_VERSION,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Términos y privacidad · La Verde",
  description:
    "Qué es La Verde, qué datos personales guarda, dónde los guarda, con quién los comparte y cómo borrarlos.",
  /* Contenido público y enlazado desde el pie en todo el sitio: declara su
     propia URL canónica para no heredar ambigüedad de parámetros. */
  alternates: { canonical: "/terminos" },
};

/* Edad mínima. Es una decisión del producto, no una cifra que venga de la ley:
   quien mantenga el sitio la cambia aquí y en el texto de una vez. */
const MIN_AGE = 16;

const H2 = "font-lv-display text-[18px] font-bold tracking-[-0.02em] text-ink";
const P = "text-small leading-[1.7] text-ink-soft";
const UL = "flex flex-col gap-gap-xs text-small leading-[1.7] text-ink-soft";
const LI = "flex gap-gap-xs";
const DOT = "mt-[9px] size-1 shrink-0 rounded-full bg-verde-400";
const LINK =
  "font-semibold text-verde-600 transition-colors duration-500 ease-outquint hover:text-verde-700";
const TH = "p-gap-xs text-left font-lv-display text-meta font-semibold text-ink";
const TD = "p-gap-xs align-top text-meta leading-[1.6] text-ink-soft";

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className={LI}>
      <span className={DOT} aria-hidden />
      <span>{children}</span>
    </li>
  );
}

/**
 * Términos y privacidad en una sola página.
 *
 * Van juntos y con la privacidad anclada (`#privacidad`) porque el enlace del
 * pie y el del perfil ya apuntan ahí y separarlos en dos documentos no le
 * serviría a nadie: lo que hay que decidir al registrarse incluye las dos cosas.
 *
 * **Esta página estuvo mintiendo y de ahí el tamaño que tiene ahora.** Decía que
 * las cuentas eran de demostración y que no había base de datos detrás, cuando
 * ya había una tabla `users` con correo, teléfono, ciudad, preferencias,
 * búsquedas y reseñas; y decía que casi todo se quedaba en el navegador «y
 * nosotros no lo vemos», cuando el perfil escribe en el servidor en cada
 * guardado. El problema no era que faltara texto: era que tranquilizaba de más.
 *
 * La regla al escribirlo: cada afirmación de aquí tiene que poder comprobarse
 * abriendo el código. Si algo cambia en el código, esto cambia con ello. La
 * versión que se enseña al final del documento es la misma constante que se
 * guarda en `users.terms_version` al aceptarla.
 *
 * **No es asesoría legal.** El texto describe lo que el sitio hace; el apartado
 * del responsable queda marcado porque todavía no hay entidad constituida, y
 * conviene que lo revise un abogado antes de que esto salga del circuito de
 * pruebas.
 */
export default function TerminosPage() {
  return (
    <div className="min-h-dvh bg-sand font-lv text-ink">
      <article className="mx-auto flex max-w-[68ch] flex-col gap-gap-xl px-gutter py-gap-2xl">
        <header className="flex flex-col gap-gap-xs">
          <span className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600">
            Legal
          </span>
          <h1 className="font-lv-display text-[32px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Términos y privacidad
          </h1>
          <p className="text-small text-pretty text-ink-soft/75">
            Última revisión: {TERMS_UPDATED_LABEL}. Versión{" "}
            <span className="font-mono">{TERMS_VERSION}</span>.
          </p>
          <p className={P}>
            Esto es lo que La Verde hace con tus datos, contado en corto y sin
            letra pequeña. Si algo de aquí no coincide con lo que ves en la
            aplicación, es un error y queremos saberlo:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className={LINK}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </header>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Qué es La Verde</h2>
          <p className={P}>
            La Verde es un buscador de lugares en Cuba. Escribes lo que buscas
            como lo dirías hablando y te devuelve sitios que encajan, con su
            horario, las monedas que aceptan y qué tienen cerca.
          </p>
          <p className={P}>
            Está en construcción y eso importa más de lo que parece. El catálogo
            que ves hoy es un conjunto de prueba con negocios reales de Santiago
            de Cuba: sirve para probar el producto, no para planear una salida.
            Un horario equivocado aquí es un horario equivocado, no una promesa
            incumplida. Si encuentras una ficha mal, escríbenos y se corrige.
          </p>
        </section>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Quién responde de esto</h2>
          <p className={P}>
            El responsable del tratamiento de tus datos es{" "}
            <span className="font-semibold text-ink">{DATA_CONTROLLER}</span>. Es
            aquí donde se reclama si algo va mal con tu información.
          </p>
          <p className={P}>
            Para cualquier cosa —dudas, correcciones, borrar tu cuenta a mano,
            ejercer tus derechos— escríbenos a{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className={LINK}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Edad mínima</h2>
          <p className={P}>
            Para tener cuenta en La Verde hay que tener {MIN_AGE} años o más. No
            pedimos la fecha de nacimiento ni la comprobamos, así que esto es una
            condición para usarla, no un filtro que apliquemos. Si detectamos una
            cuenta de alguien menor de esa edad, la borramos.
          </p>
        </section>

        <section id="privacidad" className="flex scroll-mt-24 flex-col gap-gap-sm">
          <h2 className={H2}>Privacidad: qué datos recogemos</h2>
          <p className={P}>
            Esto es todo lo que se guarda en el servidor, de dónde sale y dónde
            acaba. No hay nada más: si no está en esta tabla, no lo tenemos.
          </p>

          <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-ink/10 bg-sand-warm">
                  <th className={TH} scope="col">
                    Dato
                  </th>
                  <th className={TH} scope="col">
                    De dónde sale
                  </th>
                  <th className={TH} scope="col">
                    Dónde acaba
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-ink/5">
                  <td className={TD}>Correo y contraseña</td>
                  <td className={TD}>Al crear la cuenta</td>
                  <td className={TD}>
                    En Neon Auth. La contraseña se guarda cifrada y no la vemos
                    nunca. La tabla de La Verde no la copia.
                  </td>
                </tr>
                <tr className="border-b border-ink/5">
                  <td className={TD}>Nombre</td>
                  <td className={TD}>Al crear la cuenta y en el perfil</td>
                  <td className={TD}>
                    El que pongas en el perfil. Si no pones ninguno, la parte de
                    tu correo antes de la arroba.
                  </td>
                </tr>
                <tr className="border-b border-ink/5">
                  <td className={TD}>Teléfono</td>
                  <td className={TD}>Al crear la cuenta, opcional</td>
                  <td className={TD}>
                    Tu ficha. Puedes dejarlo vacío y la cuenta funciona igual.
                  </td>
                </tr>
                <tr className="border-b border-ink/5">
                  <td className={TD}>Ciudad, foto de perfil</td>
                  <td className={TD}>El perfil</td>
                  <td className={TD}>Tu ficha.</td>
                </tr>
                <tr className="border-b border-ink/5">
                  <td className={TD}>Intereses, ambiente, monedas</td>
                  <td className={TD}>Las preguntas de bienvenida y el perfil</td>
                  <td className={TD}>
                    Tu ficha. Es lo que decide qué lugares te enseñamos primero.
                  </td>
                </tr>
                <tr className="border-b border-ink/5">
                  <td className={TD}>Dónde estás (coordenadas)</td>
                  <td className={TD}>
                    El navegador, solo si das permiso de ubicación
                  </td>
                  <td className={TD}>
                    Tu ficha. Se puede usar la aplicación sin darlo; entonces
                    ordenamos por ciudad.
                  </td>
                </tr>
                <tr className="border-b border-ink/5">
                  <td className={TD}>Qué buscas</td>
                  <td className={TD}>El buscador</td>
                  <td className={TD}>
                    Tu historial de búsquedas, si has entrado con tu cuenta.
                  </td>
                </tr>
                <tr className="border-b border-ink/5">
                  <td className={TD}>Qué guardas</td>
                  <td className={TD}>El botón de guardar</td>
                  <td className={TD}>Tus lugares guardados.</td>
                </tr>
                <tr className="border-b border-ink/5">
                  <td className={TD}>Reseñas</td>
                  <td className={TD}>La ficha de un lugar</td>
                  <td className={TD}>
                    <span className="font-semibold text-ink">
                      Públicas.
                    </span>{" "}
                    Las ve cualquiera que abra esa ficha, con tu nombre.
                  </td>
                </tr>
                <tr className="border-b border-ink/5">
                  <td className={TD}>Qué negocios llevas</td>
                  <td className={TD}>El panel de negocio</td>
                  <td className={TD}>
                    Si eres dueño de un negocio, el vínculo entre tu cuenta y esa
                    ficha.
                  </td>
                </tr>
                <tr>
                  <td className={TD}>Tu dirección IP</td>
                  <td className={TD}>La conexión</td>
                  <td className={TD}>
                    Solo para limitar cuántas peticiones por minuto llegan de
                    cada sitio y frenar el abuso. Vive en memoria del servidor y
                    se olvida sola; no se guarda en la base ni se escribe en
                    ningún registro.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className={P}>
            Dos cosas más, que no caben en la tabla porque no son un dato tuyo
            sino de algo que es tuyo:
          </p>
          <ul className={UL}>
            <Item>
              <span className="font-semibold text-ink">
                Si registras un negocio
              </span>{" "}
              desde tu perfil, guardamos su nombre, su descripción, su
              dirección, su punto en el mapa, su horario, las monedas que acepta
              y las fotos que subas. Todo eso es{" "}
              <span className="font-semibold text-ink">público</span> en cuanto
              un administrador publica la ficha, porque es exactamente lo que
              enseña el buscador. Hasta entonces solo lo ves tú.
            </Item>
            <Item>
              <span className="font-semibold text-ink">
                El teléfono ya está en la base.
              </span>{" "}
              Hasta hace poco vivía solo en tu navegador y se perdía al cambiar
              de equipo. Ahora lo recoge el registro y se guarda en tu ficha.
            </Item>
          </ul>
          <p className={P}>
            <span className="font-semibold text-ink">Lo que no hacemos:</span> no
            hay pagos en La Verde, así que no hay datos de tarjeta ni de factura;
            no hay publicidad; no vendemos ni cedemos tus datos a nadie; y no hay
            ningún rastreador de terceros midiendo lo que haces.
          </p>
        </section>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Para qué usamos los datos</h2>
          <ul className={UL}>
            <Item>
              <span className="font-semibold text-ink">La cuenta.</span> Tu
              correo y tu contraseña son lo que te identifica y lo que impide que
              otro entre en tu perfil.
            </Item>
            <Item>
              <span className="font-semibold text-ink">
                Enseñarte lo que te sirve.
              </span>{" "}
              Dónde estás, tu ciudad y tus intereses son lo que hace que el
              buscador ordene por cercanía y no te enseñe lo que no buscas.
            </Item>
            <Item>
              <span className="font-semibold text-ink">
                Que el buscador te entienda.
              </span>{" "}
              Lo que escribes se manda a un modelo de lenguaje para que
              interprete la frase y elija lugares del catálogo.
            </Item>
            <Item>
              <span className="font-semibold text-ink">
                Que la aplicación no se caiga.
              </span>{" "}
              La IP limita peticiones y evita que un script nos deje sin servicio
              a los demás.
            </Item>
          </ul>
          <p className={P}>
            Nada de esto se usa para perfilarte, para publicidad ni para
            decisiones automáticas sobre ti más allá de ordenarte una lista de
            sitios.
          </p>
        </section>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Dónde se guardan y qué sale del país</h2>
          <p className={P}>
            Los datos de la cuenta viven en una base de datos{" "}
            <span className="font-semibold text-ink">Neon Postgres</span> alojada
            en Estados Unidos, en la región <span className="font-mono">us-east-2</span>.
            Las credenciales viven en el servicio de autenticación de Neon, aparte
            de la base. Las fotos de los negocios, en un almacén de objetos de
            Cloudflare.
          </p>
          <p className={P}>
            Dicho claro:{" "}
            <span className="font-semibold text-ink">
              tus datos se guardan fuera de Cuba
            </span>
            , en servidores de Estados Unidos. Es una consecuencia de las
            herramientas con las que está construido esto, y preferimos decirlo
            antes de que lo descubras tú.
          </p>
        </section>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Con quién se comparten</h2>
          <p className={P}>
            No vendemos datos a nadie. Pero al usar La Verde, algunas cosas salen
            hacia servicios de terceros, porque son los que hacen el trabajo:
          </p>
          <ul className={UL}>
            <Item>
              <span className="font-semibold text-ink">
                Cloudflare Workers AI
              </span>{" "}
              recibe el texto que escribes en el buscador y el catálogo de
              lugares, para elegir cuáles encajan. No recibe quién eres: no van
              ni tu correo, ni tu nombre, ni tu historial.
            </Item>
            <Item>
              <span className="font-semibold text-ink">
                Photon (komoot.io) y Nominatim (OpenStreetMap)
              </span>{" "}
              son los que convierten lo que escribes en el buscador de
              direcciones a coordenadas. Y aquí está lo importante:{" "}
              <span className="font-semibold text-ink">
                esa llamada la hace tu navegador, no nuestro servidor
              </span>
              , en cada pulsación de tecla. Lo que escribes en ese campo sale de
              tu dispositivo y va directo a ellos, sin pasar por nosotros. Si no
              quieres que eso ocurra, no uses el buscador de direcciones: el mapa
              se puede mover y la ubicación se puede marcar a mano.
            </Item>
            <Item>
              <span className="font-semibold text-ink">
                OpenStreetMap y OSRM
              </span>{" "}
              sirven las imágenes del mapa y calculan rutas. Las rutas van
              proxeadas por nuestro servidor, así que ahí no sale nada tuyo más
              allá de dos coordenadas.
            </Item>
            <Item>
              <span className="font-semibold text-ink">Neon y Cloudflare</span>{" "}
              alojan la base de datos, la autenticación y las fotos. Son quienes
              guardan físicamente lo que se describe arriba.
            </Item>
          </ul>
        </section>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Cookies</h2>
          <p className={P}>
            Hay una sola cookie, y es la de la sesión: la que dice que ya
            entraste. Está firmada y no se puede leer ni modificar sin la clave
            del servidor. No hay cookies de publicidad, ni de analítica, ni de
            terceros.
          </p>
          <p className={P}>
            No ponemos aquí cuánto dura porque no lo decidimos nosotros: la
            duración de la sesión la gobierna el servicio de autenticación de
            Neon. Cuando cierras sesión, la cookie se revoca de inmediato.
          </p>
        </section>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Qué se queda en tu navegador</h2>
          <p className={P}>
            Aparte de la base de datos, el navegador guarda cosas para que la
            aplicación vaya rápida y funcione sin conexión. Esto no sale de tu
            equipo y lo borras tú cuando quieras:
          </p>
          <ul className={UL}>
            <Item>
              <span className="font-mono text-meta">la-verde:user</span> — tus
              preferencias, para no volver a preguntarlas mientras se cargan.
            </Item>
            <Item>
              <span className="font-mono text-meta">la-verde:activity</span> —
              qué lugares has abierto y guardado, para las métricas de tu perfil.
            </Item>
            <Item>
              <span className="font-mono text-meta">
                la-verde:recent-searches
              </span>{" "}
              — las últimas búsquedas que escribiste. Es lo más personal que
              guarda el navegador.
            </Item>
            <Item>
              <span className="font-mono text-meta">
                la-verde:last-position
              </span>{" "}
              — la última ubicación que diste, para no volver a pedírtela.
            </Item>
          </ul>
          <p className={P}>
            Para borrarlo todo de una vez: los ajustes del perfil tienen el botón
            de borrar la cuenta, y «borrar datos del sitio» en tu navegador hace
            el resto.
          </p>
        </section>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Cuánto tiempo los guardamos</h2>
          <p className={P}>
            Mientras tengas cuenta. No hay borrado automático por inactividad:
            una cuenta sin usar sigue ahí con sus datos hasta que la borres.
          </p>
          <p className={P}>
            El negocio que registres se queda mientras tu cuenta exista. Borrar
            la cuenta se lo lleva también, con sus fotos y su horario: no
            quedaría nadie que pudiera editarlo. Las búsquedas del historial y
            la actividad del navegador se borran igual, al borrar tu cuenta o los
            datos del sitio.
          </p>
        </section>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Tus derechos</h2>
          <p className={P}>
            <span className="font-semibold text-ink">Ver lo que tenemos.</span> El
            perfil te enseña tus datos tal como están guardados. Si quieres el
            detalle completo de lo que hay en el servidor, pídelo por correo.
          </p>
          <p className={P}>
            <span className="font-semibold text-ink">Corregirlo.</span> Puedes
            cambiar tu nombre, tu teléfono, tu ciudad, tu foto y tus preferencias
            desde el perfil, en cualquier momento.
          </p>
          <p className={P}>
            <span className="font-semibold text-ink">Borrarlo.</span> En el
            perfil, en «Configuración», hay un botón para borrar tu cuenta.
            Cuando lo pulsas se borra de verdad: desaparece tu ficha y con ella
            tus lugares guardados, tus reseñas, tu historial de búsquedas y los
            negocios que llevaras. No hay vuelta atrás y no guardamos copia.
          </p>
          <p className={P}>
            Si prefieres que lo hagamos nosotros, o si el botón falla, escribe a{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className={LINK}>
              {SUPPORT_EMAIL}
            </a>{" "}
            desde el correo de tu cuenta y lo borramos a mano.
          </p>
          <p className={P}>
            Ten en cuenta una cosa:{" "}
            <span className="font-semibold text-ink">
              si el servicio de autenticación rechaza el borrado de la credencial
            </span>{" "}
            —la cuenta de correo y contraseña, que vive aparte de tu ficha—, tus
            datos personales se van igual, pero la credencial puede quedarse. La
            aplicación te lo dice cuando pasa, y en ese caso escríbenos para
            rematarlo.
          </p>
        </section>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Seguridad</h2>
          <p className={P}>
            Las contraseñas se guardan cifradas y nunca las vemos. La sesión va
            en una cookie firmada que no se puede falsificar sin la clave del
            servidor. El sitio viaja siempre por HTTPS y no se puede incrustar en
            otra página, que es como se roban las sesiones desde fuera.
          </p>
          <p className={P}>
            Ninguna de esas medidas te sirve si reutilizas la contraseña en otro
            sitio. Usa una distinta.
          </p>
        </section>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Uso aceptable</h2>
          <p className={P}>No uses La Verde para:</p>
          <ul className={UL}>
            <Item>Publicar datos falsos de un negocio o suplantar a otro.</Item>
            <Item>
              Sacar el catálogo con medios automatizados o revenderlo.
            </Item>
            <Item>
              Meterse en la cuenta de otra persona o intentar romper el sitio.
            </Item>
            <Item>
              Publicar reseñas con insultos, datos personales de terceros o
              contenido que no sea tuyo.
            </Item>
          </ul>
          <p className={P}>
            Si algo de esto pasa, podemos cerrar la cuenta. Si ves que algo así
            está ocurriendo, escríbenos.
          </p>
        </section>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Lo que publicas</h2>
          <p className={P}>
            Las reseñas son públicas: las ve cualquiera que abra esa ficha, con
            tu nombre. El texto sigue siendo tuyo, pero al publicarlo nos das
            permiso para enseñarlo dentro de La Verde sin límite de tiempo. Si
            borras tu cuenta, las reseñas se van con ella.
          </p>
          <p className={P}>
            Los datos de los negocios los sube quien los lleva, y es esa persona
            quien responde de que sean ciertos y de tener derecho a publicarlos.
          </p>
        </section>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Límite de responsabilidad</h2>
          <p className={P}>
            La Verde te enseña un catálogo. No es parte de ningún negocio que
            aparezca aquí y no responde por lo que pase cuando vayas: ni por el
            horario que cambió sin avisar, ni por el precio, ni por la calidad de
            lo que te sirvan.
          </p>
          <p className={P}>
            El sitio se ofrece tal como está, y está en construcción. No
            garantizamos que funcione sin interrupciones ni que la información de
            cada ficha esté siempre al día.
          </p>
        </section>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Cambios en estos términos</h2>
          <p className={P}>
            Cuando el texto cambie, cambia la versión que aparece arriba y con
            ella la fecha. Si el cambio afecta a tus datos, te avisamos la
            próxima vez que entres para que lo leas y lo aceptes otra vez.
          </p>
          <p className={P}>
            Lo que aceptaste queda guardado con la fecha y la versión en tu
            ficha. Se guarda la última que aceptaste, no el historial completo.
          </p>
        </section>

        <section className="flex flex-col gap-gap-sm">
          <h2 className={H2}>Ley aplicable</h2>
          <p className={P}>
            Estas condiciones se rigen por la ley cubana, que es donde está el
            catálogo y donde tiene sentido que se resuelva cualquier disputa.
          </p>
          <p className={P}>
            Y una honestidad final:{" "}
            <span className="font-semibold text-ink">
              este texto no está revisado por un abogado
            </span>
            . Describe con exactitud lo que el sitio hace, que es lo que está a
            nuestro alcance, pero si vas a usar La Verde en serio merece una
            lectura profesional.
          </p>
        </section>

        <Link
          href="/home"
          className="inline-flex h-11 w-fit items-center justify-center rounded-full border border-ink/10 bg-white px-gap-lg font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50"
        >
          Volver a La Verde
        </Link>
      </article>
    </div>
  );
}
