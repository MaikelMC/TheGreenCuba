+ # 14. El negocio: qué es Cuba Negocios y cómo gana dinero
+ 
+ ## 14.1 Qué vende
+ 
+ **Cuba Negocios** (`cubanegocios.net`) se presenta como «la aplicación de negocios en Cuba para encontrar productos y servicios cerca de ti». No es un directorio web con fichas indexables: es una **app Android de geolocalización** —mapa de negocios, filtros por municipio y provincia, fichas, favoritos y avisos— más una **cartelera digital diaria** que cada negocio actualiza con lo que tiene hoy, a qué precio y con qué disponibilidad. **(Observado:** home, ficha de Google Play.)
+ 
+ El sitio web no vende el producto: **vende la descarga**. Su función es explicar los dos roles (cliente y negocio), publicar los planes, captar vendedores y dar soporte legal. **(Observado:** el menú entero son anclas de la misma página —`#clientes`, `#negocios`, `#Planes`, `#Equipo`, `#Blog`—, y el `wp-json` solo declara **6 páginas**: portada, dos landings, «Acerca de», «Eliminar cuenta» y «Redes Sociales y Plataformas».)
+ 
+ La consecuencia estratégica es la primera y la más importante de todo el capítulo: **Cuba Negocios no tiene superficie web que competir.** Su producto vive dentro de una app que Google no indexa por negocio. Todo su tráfico depende de Play Store, del blog y del boca a boca.
+ 
+ ## 14.2 Quién está detrás
+ 
+ **Observado:** un equipo cubano pequeño y con nombres y caras públicas. La home lista cuatro roles —fundador y jefe de proyecto (A. Ruano), desarrollador backend (Eider), desarrollador Flutter (Miguel A.) y diseñador gráfico (Eric Bain)— y cuatro citas atribuidas a A. Ruano, Miguel A. López, Yaidel Araujo y Eider Ochoa. Hay enlaces a Facebook, Instagram, LinkedIn y un canal de Telegram.
+ 
+ **Inferido:** el reparto de roles describe una empresa de producto, no una agencia: alguien diseña, alguien hace backend y alguien hace la app. No hay figura de marketing ni de ventas en el equipo, y eso encaja con que el crecimiento se delegue en un **programa de vendedores comisionados** (ver §14.4) en lugar de en un equipo comercial propio.
+ 
+ **Observado:** la infraestructura es de bajo coste y de una sola persona: WordPress sobre Hostinger/LiteSpeed (IP `168.231.67.159`), sin CDN delante, y una API Node/Express en nginx (IP `168.231.67.159` según la resolución del dominio, con `X-Powered-By: Express`).
+ 
+ ## 14.3 A quién sirve
+ 
+ **Observado** en la landing y en la ficha de Play Store, hay tres públicos y no dos:
+ 
+ | Rol | Qué recibe | Qué paga |
+ |---|---|---|
+ | **Cliente** | Mapa, directorio, filtros, fichas, favoritos, avisos cuando un favorito actualiza la cartelera | Nada |
+ | **Negocio / emprendedor** | Presencia en el mapa, cartelera digital diaria, avisos a seguidores, contacto por WhatsApp | 2 o 5 USD/mes |
+ | **Vendedor** | Comisión fija en CUP por cada negocio que suscribe, más formación en venta | Nada; cobra |
+ 
+ El tercer rol es la pieza que casi ningún competidor cubano tiene montada y la que explica cómo una app con 1.000 descargas declaradas pretende crecer: **convierte a cada persona de la calle en un comercial pagado por resultado, en CUP.**
+ 
+ ## 14.4 Cómo gana dinero
+ 
+ **Observado:** cuatro fuentes, de las cuales dos son reales hoy y dos son intención.
+ 
+ | Fuente | Mecanismo | Estado |
+ |---|---|---|
+ | **Suscripción** | Plan Emprendedor **2 USD/mes** y Plan Empresas **5 USD/mes** («Popular», contiene el anterior) | Observado en la home |
+ | **Cobro en CUP** | «Nuestros planes se pueden pagar en CUP al cambio establecido en nuestra Aplicación» | Observado (declarado) |
+ | **Canal de vendedores** | Comisión fija en CUP por suscripción: 100 / 300 / 600 CUP (Emprendedor mensual/semestral/anual) y 700 / 800 / 1.000 CUP (Empresas) | Observado en la landing de vendedores de la home |
+ | **Publicidad / afiliación** | No se observa ningún anuncio, red publicitaria ni enlace de afiliado en la web ni en la ficha de Play Store | Observado (ausencia) |
+ 
+ **Lo que incluye cada plan (observado, literal de la home):**
+ 
+ - **Emprendedor — 2 USD/mes:** catálogo digital con precios y disponibilidad; notificaciones a seguidores al actualizar la cartelera; contacto directo por WhatsApp; recordatorio para mantener la cartelera al día; compartir cartelera por redes sociales; soporte estándar por chat/correo.
+ - **Empresas — 5 USD/mes:** todo lo anterior + creación de **multinegocios**; **importación masiva por Excel/CSV**; plantilla CSV para productos y servicios; importación de productos sugeridos; soporte prioritario.
+ 
+ **El detalle de modelo que importa:** el producto se vende por **2 USD/mes**, la mitad que el pack más barato de LaVerde (3,5 USD). Pero esa entrada no incluye pedidos, ni reservas, ni web propia, ni analítica: es literalmente «existir en el mapa y tener cartelera». Es una **estrategia de precio de penetración** en un mercado donde 2 USD mensuales ya es dinero, y está calibrada para que el primer «sí» sea fácil.
+ 
+ **Inferido:** la comisión del vendedor es barata para la empresa. Un Plan Empresas anual son 60 USD; si el tipo de cambio que aplica la app ronda los 700 CUP por USD, son ~42.000 CUP de ingreso contra 1.000 CUP de comisión (≈2,4 %). Incluso con una tasa muy distinta, la comisión se mantiene en un dígito. **El coste de adquisición está denominado en la moneda que el mercado sí tiene, mientras el ingreso está denominado en la que escasea.** Es la decisión de negocio más inteligente que se observa en todo el sitio.
+ 
+ ## 14.5 La cadena de valor
+ 
+ 1. **Captación del negocio** — puerta a puerta por vendedores comisionados, o registro directo desde la web/app.
+ 2. **Alta y geolocalización** — datos básicos + ubicación en el mapa (así lo describe la landing: «Registras tu negocio con los datos básicos → Indicas tu ubicación en el mapa»).
+ 3. **Cartelera** — el negocio publica productos, servicios, precios y novedades del día.
+ 4. **Distribución** — mapa, búsqueda por categoría/municipio, ficha, favoritos.
+ 5. **Retención** — aviso push al seguidor cuando el negocio actualiza la cartelera, más un recordatorio al negocio para que no la deje morir.
+ 
+ El eslabón 5 es el que sostiene el negocio: una cartelera que no se actualiza convierte la app en un directorio muerto, y por eso el producto tiene **dos recordatorios**: uno para el negocio («mantén la cartelera al día») y otro para el cliente («tu negocio favorito publicó algo»).
+ 
+ ## 14.6 Cómo adquiere usuarios
+ 
+ **Observado:** cinco canales, todos de coste bajo o variable.
+ 
+ - **Google Play** como destino único de la conversión (el botón «Descargar en Play Store» es el CTA principal del sitio; paquete `cu.cubanegocios.net`).
+ - **Programa de vendedores** con comisión en CUP y una landing propia dentro de la home («¿Cuánto puedes ganar como vendedor?», «El límite es el cielo»).
+ - **Blog en subdominio** (`blog.cubanegocios.net`), instalación WordPress aparte.
+ - **Redes sociales** (Facebook, Instagram, LinkedIn, Telegram).
+ - **WhatsApp de soporte** en la propia web, con un número **mexicano** (`+52 1 55 4181 0822`).
+ 
+ **Observado:** no hay páginas de negocio públicas. `wp-json` solo expone 6 páginas y ninguna es una ficha de empresa, producto o servicio. **Cuba Negocios renuncia por completo al SEO long-tail** del tipo «panadería en Marianao» o «cerveza artesanal La Habana», que es exactamente el terreno donde LaVerde sí compite.
+ 
+ ## 14.7 Qué le cuesta y qué le duele
+ 
+ **Observado** en el propio comportamiento del servidor, que es la mejor radiografía de una operación pequeña:
+ 
+ - **Inestabilidad de respuesta.** De las peticiones hechas para este análisis, varias terminaron en timeout con 114.682 bytes ya recibidos, una cerró con `schannel: server closed abruptly (missing close_notify)` y `sitemap_index.xml` no se pudo descargar en tres intentos consecutivos. La web se sirve, pero no siempre termina de servirse.
+ - **Sin CDN.** `Server: LiteSpeed` + `platform: hostinger` directo, sin Cloudflare ni caché de borde. Cada visita golpea el mismo origen.
+ - **Título duplicado en la portada:** `<title>Cuba Negocios App &#8211; Cuba Negocios App</title>`. Un fallo de configuración de Yoast que cuesta CTR en el único tráfico orgánico que tienen.
+ - **El panel de gestión no resuelve públicamente:** la API restringe CORS a `https://cnmanager.cubanegocios.net`, y ese host **no resuelve por DNS** desde fuera. **Inferido:** el panel del negocio vive en la app, y el manager web es interno o aún no publicado.
+ - **Documentación de API cerrada:** `/docs` devuelve 401. **Inferido:** hay una API documentada para uso interno o de integradores, no pública.
+ - **El coste real del producto es el contenido:** cada negocio debe reescribir su cartelera cada día. Sin ese hábito, el mapa se vacía. De ahí el recordatorio como función de plan.
+ 
+ ## 14.8 Riesgos estructurales
+ 
+ **Inferido:** tres dependencias que el operador no controla.
+ 
+ 1. **Google Play.** Si la app se cae del store, o si Google cambia políticas de geolocalización/notificaciones, el negocio desaparece: no hay web que lo sustituya.
+ 2. **El esfuerzo del vendedor.** El canal no escala solo: escala con personas. Y paga comisión en CUP, una moneda que se devalúa.
+ 3. **El hábito de la cartelera.** Todo el valor para el cliente depende de que cientos de negocios actualicen a diario. Es el mismo problema que LaVerde resuelve con «Hoy hay», pero a escala de todo el catálogo.
+ 
+ ---
+ 
+ # 15. Stack y arquitectura observada
+ 
+ | Capa | Tecnología | Evidencia |
+ |---|---|---|
+ | **Web comercial** | WordPress + tema `hello-elementor` | `wp-content/themes/hello-elementor` |
+ | **Constructor** | Elementor **4.4.1** + Elementor Pro + Happy Addons | `<meta name="generator" content="Elementor 4.4.1…">` |
+ | **Formularios** | Fluent Forms + Fluent Forms Pro | `wp-content/plugins/fluentform`, `fluentformpro` |
+ | **SEO** | Yoast SEO **28.9** + Google Site Kit 1.187.0 | meta generator y `robots.txt` |
+ | **Chat** | Creame WhatsApp Me (widget de soporte) | `wp-content/plugins/creame-whatsapp-me` |
+ | **Hosting** | Hostinger, LiteSpeed, HTTP/3 (`alt-svc h3`), IP `168.231.67.159` | cabeceras |
+ | **CDN / WAF** | Ninguno observado | ausencia de Cloudflare en cabeceras |
+ | **API** | Node.js + **Express** detrás de nginx, raíz `Hello World!` | `X-Powered-By: Express`, cuerpo 12 bytes |
+ | **CORS** | Restringido a `https://cnmanager.cubanegocios.net` | `Access-Control-Allow-Origin` |
+ | **Cabeceras de seguridad API** | `X-Frame-Options: DENY`, `nosniff`, `X-XSS-Protection`, HSTS 1 año con `includeSubDomains`, `Referrer-Policy: strict-origin-when-cross-origin` | cabeceras |
+ | **App** | Android nativa, desarrollada en **Flutter** según el equipo | Play Store + home |
+ | **Blog** | WordPress separado en subdominio | `blog.cubanegocios.net`, IP `145.223.124.45` |
+ 
+ **Lectura técnica en una frase:** es un **WordPress de marketing + una API Express + una app Flutter**, sin SPA, sin SSR, sin motor de búsqueda y sin CDN. Comparado con los capítulos 1 y 2, es la arquitectura más simple de las tres —y la más barata de operar— y también la que menos puede crecer en superficie web.
+ 
+ **Observado:** la API responde `Hello World!` en la raíz. Eso, más `X-Powered-By: Express`, indica un esqueleto Node sin ofuscación ni ocultación de stack. No es un problema de seguridad en sí (las cabeceras están bien puestas), pero delata que no hay equipo de plataforma detrás.
+ 
+ **Desconocido:** el motor de base de datos, el esquema, el mecanismo de notificaciones (FCM es la hipótesis obvia en Flutter, pero no es observable desde el sitio), la pasarela con la que se cobra en CUP y el método real de cálculo del tipo de cambio.
+ 
+ ---
+ 
+ # 16. Cómo funciona el producto, mecanismo a mecanismo
+ 
+ ## 16.1 Alta y geolocalización
+ 
+ **Observado (declarado en la landing, no verificado):** el flujo del negocio son cuatro pasos —registrar datos básicos, indicar ubicación en el mapa, crear la cartelera, aparecer ante clientes que guardan y reciben avisos—. **Inferido:** el alta es autoservicio y no requiere visita ni verificación documental; no hay en el sitio ningún «negocio verificado» ni ningún proceso de validación descrito.
+ 
+ ## 16.2 La cartelera digital diaria
+ 
+ Es la unidad central del producto y la diferencia conceptual más interesante respecto a un directorio clásico: **no es un catálogo, es un estado del día.** El negocio no mantiene una lista de productos con precio; publica «esto es lo que hay hoy». (Observado: «cartelera digital diaria para publicar tus productos, servicios, precios y novedades»; «recordatorio para mantener la cartelera al día».)
+ 
+ **Por qué es una buena decisión de producto:** en Cuba la disponibilidad cambia a diario por abastecimiento, y un catálogo con precios de hace tres semanas es peor que no tener catálogo. Al convertir el catálogo en una publicación periódica, el producto se alinea con la realidad y además crea un motivo de notificación (§16.4).
+ 
+ ## 16.3 Mapa y búsqueda
+ 
+ **Observado:** mapa de Cuba con filtros por municipio y provincia, y búsqueda por «ubicación, categoría o necesidad». **Desconocido:** si el mapa es un proveedor externo (Google/Mapbox/MapLibre), si hay búsqueda por radio y si existe geocodificación de direcciones; nada de eso es visible desde la web.
+ 
+ **Inferido:** con 180 negocios declarados, la búsqueda por categoría y municipio es suficiente. No hay indicio de búsqueda semántica, y el texto de la landing no la menciona en ningún momento.
+ 
+ ## 16.4 Favoritos y notificaciones
+ 
+ **Observado:** el cliente marca negocios como favoritos y «recibe notificaciones cuando tus negocios favoritos actualicen su cartelera o tengan nuevas ofertas».
+ 
+ Este es el mecanismo de retención más fuerte del producto y conviene entenderlo bien: **el aviso no lo dispara una promoción de la plataforma, lo dispara el negocio.** El negocio publica, el cliente que lo sigue recibe push. Eso convierte al negocio en el generador de contenido y a la app en el canal. LaVerde tiene el equivalente conceptual (seguir negocios, avisos push y de Telegram), pero Cuba Negocios lo pone en el **plan de 2 USD**, no en el de 10.
+ 
+ ## 16.5 Multinegocio e importación CSV
+ 
+ **Observado:** el Plan Empresas (5 USD) permite **crear varios negocios bajo una cuenta** e **importar productos y servicios por Excel/CSV**, con plantilla propia y catálogo sugerido.
+ 
+ **Por qué importa:** resuelve el problema de los emprendedores cubanos que operan varias unidades (varias cafeterías, varios puntos de venta) y el de quien ya tiene su inventario en Excel. LaVerde también soporta varios negocios por dueño e importación CSV, pero en Cuba Negocios la importación está en un plan de 5 USD —es decir, se usa como **argumento de upsell barato**, no como función premium.
+ 
+ ## 16.6 Cobro y planes
+ 
+ **Observado:** dos planes, precios en USD en la web, cobro en CUP «al cambio establecido en nuestra Aplicación», sin prueba gratuita mencionada, sin descuento por pago anual anunciado en la web (aunque las comisiones de vendedor distinguen mensual/semestral/anual, lo que implica que **sí existen** esas modalidades).
+ 
+ **Desconocido:** pasarela, política de reembolsos, tasa aplicada y qué pasa si un negocio deja de pagar (¿se despublica la cartelera? ¿sigue en el mapa?).
+ 
+ ## 16.7 El panel: solo app
+ 
+ **Observado:** la API solo autoriza CORS desde `cnmanager.cubanegocios.net`, y ese host no resuelve. **Inferido:** la gestión del negocio se hace **desde la app Android**. Eso tiene dos efectos: obliga a instalar la app para vender (barrera real para un dueño de 60 años) y deja al negocio sin forma de gestionar su ficha desde una computadora.
+ 
+ LaVerde hace lo contrario —panel web completo, más bot de Telegram como atajo— y en eso lleva ventaja clara.
+ 
+ ---
+ 
+ # 17. Qué copiar: los puntos fuertes reales de Cuba Negocios
+ 
+ ## 17.1 El programa de vendedores con comisión en CUP
+ 
+ **Dato:** 100/300/600 CUP por suscripción Emprendedor (mensual/semestral/anual) y 700/800/1.000 CUP por Empresas, más una landing con calculadora aspiracional («10 negocios hasta 6.000 CUP», «El límite es el cielo»).
+ 
+ **Por qué funciona:** en un país donde el dueño de un negocio no compra software por internet pero sí escucha a alguien que lo visita en persona, un vendedor comisionado resuelve a la vez la confianza y la educación. Y se le paga en la moneda que circula, con un coste que solo existe si hay venta.
+ 
+ **Qué replicar en LaVerde:** un programa de «colaboradores» con enlace o código, comisión en CUP por alta y por renovación, y una landing con el cálculo explícito de cuánto se gana. LaVerde ya tiene afiliados con código y página de enlaces; lo que falta es **la comisión en CUP y el discurso de «esto es un ingreso»,** no un descuento para el amigo.
+ 
+ ## 17.2 El aviso push atado a la cartelera del negocio
+ 
+ **Dato:** «Recibe notificaciones cuando tus negocios favoritos actualicen su cartelera o tengan nuevas ofertas».
+ 
+ **Por qué funciona:** es la única notificación que el usuario agradece, porque la pidió él al guardar el negocio. Y le da al negocio un motivo concreto para pagar: publicar en la app equivale a avisar a sus clientes.
+ 
+ **Qué replicar:** en LaVerde, cualquier actualización de catálogo debería poder disparar un aviso a los seguidores del negocio, con una frase generada («X publicó 3 novedades»), sin que el dueño tenga que escribir nada.
+ 
+ ## 17.3 La cartelera como «estado del día», no como catálogo
+ 
+ **Dato:** todo el producto habla de «cartelera diaria», no de menú ni de catálogo, y existe un recordatorio específico para mantenerla al día.
+ 
+ **Por qué funciona:** en Cuba la disponibilidad caduca. Un producto que asume eso se ve más honesto que uno que muestra un menú de hace un mes.
+ 
+ **Qué replicar:** LaVerde ya tiene «Hoy hay» en el catálogo, pero está enterrado como un flag por producto. Merece ser **un modo de la ficha** («Cartelera de hoy») con fecha visible y un recordatorio al dueño si lleva días sin publicar.
+ 
+ ## 17.4 Precio de entrada de 2 USD
+ 
+ **Dato:** Emprendedor 2 USD/mes frente a los 3,5 USD del pack Esencial de LaVerde.
+ 
+ **Por qué funciona:** baja la barrera del primer pago a la mitad sin regalar funciones caras: el plan barato no incluye pedidos, ni reservas, ni QR sin marca, ni analítica.
+ 
+ **Qué replicar:** un escalón de entrada más barato que «existir y publicar», y dejar el resto para el pack. LaVerde hoy no tiene un plan de 1–2 USD, así que su primer «sí» cuesta casi el doble.
+ 
+ ## 17.5 Onboarding explicado como cuatro pasos visibles
+ 
+ **Dato:** «Registras tu negocio con los datos básicos → Indicas tu ubicación en el mapa → Creas tu cartelera → Tus clientes te encuentran».
+ 
+ **Por qué funciona:** el dueño ve el final del túnel antes de empezar, sin jerga. Es la misma lógica que LaVerde aplica en su landing, pero aquí está en cuatro líneas y sin promesas que el producto no cumple.
+ 
+ **Qué replicar:** mantener el onboarding de LaVerde en cuatro pasos literales y con el mismo dibujo mental (mapa → carta → clientes), y medir cuántos lo completan.
+ 
+ ## 17.6 App nativa en Play Store
+ 
+ **Dato:** `cu.cubanegocios.net` publicado, con reseñas y actualizaciones, y push real.
+ 
+ **Por qué funciona:** en Cuba, «está en Play Store» sigue siendo un certificado de existencia. Y una app nativa da notificaciones fiables, algo que una PWA en Android consigue a medias.
+ 
+ **Qué replicar (con matices):** LaVerde apostó por PWA por peso y por datos móviles, y esa decisión sigue siendo correcta para el cliente. Pero para **el dueño del negocio**, una app ligera o al menos notificaciones push fiables en Android es lo que hace que el aviso llegue. Es el punto donde la PWA pierde contra la app.
+ 
+ ---
+ 
+ # 18. Qué atacar: los huecos reales de Cuba Negocios
+ 
+ ## 18.1 Cero SEO de negocios: todo el valor está dentro de la app
+ 
+ **Evidencia:** 6 páginas en `wp-json`, ninguna ficha pública; el menú son anclas; la portada es la única URL de contenido.
+ 
+ **El hueco:** nadie llega a Cuba Negocios buscando «cervecería en Centro Habana» en Google, porque esa página no existe. Toda su adquisición pasa por Play Store y por vendedores. LaVerde, con `/lugares/[categoria]/[ciudad]` y datos estructurados, captura exactamente esa demanda.
+ 
+ **Cómo explotarlo:** publicar páginas de «[categoría] en [ciudad]» con fichas reales, contenido útil y enlaces a la ficha de cada negocio. Es el canal que Cuba Negocios no puede copiar sin reconstruir su producto como web.
+ 
+ ## 18.2 No hay búsqueda semántica
+ 
+ **Evidencia:** la landing solo promete «busca por ubicación, categoría o necesidad»; no hay ninguna mención a lenguaje natural ni a IA.
+ 
+ **El hueco:** el usuario cubano no busca «restaurante / categoría 12 / municipio Playa»; busca «un lugar barato para comer cerca de la Terminal». LaVerde tiene búsqueda en lenguaje natural con IA y pgvector. Cuba Negocios tiene facets.
+ 
+ ## 18.3 El flujo termina en WhatsApp
+ 
+ **Evidencia:** «Contacto Directo por WhatsApp» es una función del plan; no hay carrito, ni pedido, ni reserva.
+ 
+ **El hueco:** el cliente encuentra el producto, ve el precio y... sale a WhatsApp a escribir a mano qué quiere. LaVerde cierra el ciclo con carrito, mensaje prearmado y reservas por aforo. **Cuba Negocios digitaliza el escaparate, no la transacción.**
+ 
+ ## 18.4 La cartelera no es una URL
+ 
+ **Evidencia:** la cartelera se comparte «por redes sociales», pero no hay ninguna página pública de negocio ni de producto.
+ 
+ **El hueco:** un negocio no puede poner su cartelera en su bio de Instagram ni imprimir un QR que lleve a ella. Cada vez que quiere enseñar lo que tiene, manda una captura. LaVerde tiene menú QR con URL propia y QR imprimible. Es una diferencia que el dueño entiende en diez segundos.
+ 
+ ## 18.5 Gestión solo desde Android
+ 
+ **Evidencia:** no hay panel web público; el host del manager no resuelve.
+ 
+ **El hueco:** un negocio con inventario grande no va a cargar 200 productos desde un teléfono. El plan de 5 USD incluye CSV, pero el archivo hay que subirlo desde la app. LaVerde permite gestionar desde el navegador y, además, desde Telegram.
+ 
+ ## 18.6 Señales de operación frágil
+ 
+ **Evidencia:** timeouts con 114 KB ya recibidos, cierre abrupto de conexión, `sitemap_index.xml` inaccesible en tres intentos, `<title>` duplicado, sin CDN, logo subido en `2025/11`.
+ 
+ **El hueco:** es un competidor **joven y de una sola persona en la infraestructura**. Eso no lo hace malo —con 2 USD y una app hace cosas que LaVerde no hace— pero significa que su capacidad de reacción es limitada. Si LaVerde ejecuta rápido en app + SEO + pedidos, la ventana se cierra antes de que ellos la cubran.
+ 
+ ## 18.7 Solo Android, precios en dólares y sin prueba
+ 
+ **Evidencia:** el único enlace de descarga es Play Store; los precios se muestran en USD; no hay trial visible.
+ 
+ **El hueco:** el usuario de iPhone queda fuera y el dueño que quiere probar antes de pagar no tiene puerta de entrada. LaVerde ofrece 30 días de Pro; Cuba Negocios no ofrece nada equivalente.
+ 
+ ---
+ 
+ # 19. El flujo completo de Cuba Negocios, de punta a punta
+ 
+ > Un solo párrafo, con la misma convención: **(observado)** sale del sitio, de la API o de la ficha de Play Store; **(inferido)** es mi lectura del diseño.
+ 
+ Cuba Negocios empieza en una **página de WordPress de 244 KB construida con Elementor** (observado) que no intenta posicionar negocios sino **una sola acción: instalar la app** (observado: el CTA principal es Play Store, paquete `cu.cubanegocios.net`), y que se organiza como un folleto de dos columnas —«para clientes» y «para negocios»— con cuatro contadores animados que declaran **1.000 descargas, 750 clientes, 180 negocios y 300 activos diarios** (observado en los `data-to-value` de Elementor, sin verificación posible) y dos planes de **2 y 5 USD/mes** que se cobran **en CUP al cambio que fija la propia app** (observado), servidos desde un hosting compartido de Hostinger con LiteSpeed y sin CDN delante (observado); el crecimiento no lo hace el SEO —no hay ni una ficha pública de negocio, solo seis páginas en `wp-json`— sino **un ejército de vendedores comisionados** a los que la home promete 100 a 1.000 CUP por suscripción y una landing con calculadora de ingresos (observado), lo que en la práctica convierte el producto en una **venta puerta a puerta de software a 2 USD** (inferido); una vez el negocio paga, entra por la app (no hay panel web: el host que la API autoriza por CORS, `cnmanager.cubanegocios.net`, **no resuelve por DNS**, observado), registra sus datos, **marca su punto en el mapa de Cuba** y publica su **cartelera digital diaria** —productos, precios y disponibilidad del día, con opción de importar todo desde Excel/CSV en el plan de 5 USD y de gestionar varios negocios bajo la misma cuenta (observado)—; el cliente, desde Android, abre el mapa, filtra por **municipio o provincia**, mira la ficha, guarda el negocio como **favorito** y a partir de ahí recibe **una notificación push cada vez que ese negocio actualiza su cartelera** (observado), que es el único mecanismo de retención real del sistema y también el único motivo por el que el negocio sigue pagando; cuando quiere comprar, el flujo **se rompe en WhatsApp** —no hay carrito, ni pedido, ni reserva, ni pago (observado)— y cuando quiere enseñar su cartelera fuera de la app, **manda una captura**, porque la cartelera no tiene URL propia ni QR (observado); por debajo, la API es un **Express sobre nginx que responde `Hello World!`** en la raíz, con CORS cerrado al manager interno, cabeceras de seguridad correctas y `/docs` protegido con 401 (observado), y el conjunto se sostiene sobre un WordPress que a veces **no termina de enviar la respuesta** —tres timeouts y un cierre abrupto durante este análisis, y el `sitemap_index.xml` inaccesible en tres intentos (observado)—; el resultado es un producto **honesto, barato y bien pensado para la venta**, que resuelve el escaparate y el aviso pero deja fuera la transacción, la web y la búsqueda inteligente: exactamente los tres terrenos donde LaVerde ya está construido.
+ 
+ ---
+ 
+ # 20. Tabla de evidencia del tercer objetivo
+ 
+ | Hallazgo | Dónde | Tipo |
+ |---|---|---|
+ | WordPress + Hello Elementor + Elementor 4.4.1 Pro | `home.html`, `wp-content/plugins` | Observado |
+ | Yoast SEO 28.9 + Site Kit 1.187.0 | meta generator y `robots.txt` | Observado |
+ | Hosting Hostinger/LiteSpeed, sin CDN | cabeceras (`platform: hostinger`) | Observado |
+ | API Node/Express en nginx, raíz `Hello World!` | `api.cubanegocios.net` | Observado |
+ | CORS restringido a `cnmanager.cubanegocios.net` | cabecera `Access-Control-Allow-Origin` | Observado |
+ | `cnmanager.cubanegocios.net` no resuelve | `Could not resolve host` | Observado |
+ | `/docs` de la API protegido (401) | `api.cubanegocios.net/docs` | Observado |
+ | Solo 6 páginas públicas, ninguna ficha de negocio | `wp-json/wp/v2/pages` | Observado |
+ | Menú sin rutas: solo anclas `#clientes`, `#negocios`, `#Planes`, `#Equipo` | `home.html` | Observado |
+ | `<title>` duplicado «Cuba Negocios App – Cuba Negocios App» | `home.html` | Observado |
+ | Contadores: 1.000 descargas / 750 clientes / 180 negocios / 300 activos diarios | `data-to-value` de Elementor | Observado (declarado, no verificable) |
+ | Plan Emprendedor 2 USD/mes y Empresas 5 USD/mes | home, sección Planes | Observado |
+ | Cobro en CUP «al cambio establecido en nuestra Aplicación» | home, nota bajo los planes | Observado |
+ | Comisiones de vendedor 100–1.000 CUP según plan y modalidad | home, bloque «vendedor» | Observado |
+ | Cartelera digital diaria + recordatorio para mantenerla | home, beneficios de negocios | Observado |
+ | Push a seguidores cuando un favorito actualiza cartelera | home + ficha de Play Store | Observado (declarado) |
+ | Multinegocio + importación Excel/CSV en el plan de 5 USD | home, Plan Empresas | Observado |
+ | Contacto directo por WhatsApp como función de plan | home, Plan Emprendedor | Observado |
+ | Sin carrito, pedidos ni reservas | ausencia total en home y Play Store | Observado (ausencia) |
+ | Sin páginas públicas de negocio, producto ni cartelera | `wp-json` + `robots.txt` | Observado |
+ | Solo Android; sin enlace a App Store | home + Play Store | Observado |
+ | Sin prueba gratuita anunciada | home, sección Planes | Observado |
+ | Sin publicidad ni afiliación de terceros | ausencia en HTML y Play Store | Observado (ausencia) |
+ | Soporte por WhatsApp con número mexicano (+52) | enlace `api.whatsapp.com` | Observado |
+ | Blog en subdominio WordPress aparte | `blog.cubanegocios.net` (IP `145.223.124.45`) | Observado |
+ | Inestabilidad: timeouts con 114 KB recibidos, cierre abrupto, sitemap inaccesible | peticiones de este análisis | Observado |
+ | Mapa: proveedor, radio de búsqueda y geocodificación | — | **Desconocido** |
+ | Motor de notificaciones (FCM u otro) | — | **Desconocido** |
+ | Pasarela de cobro y tasa de cambio aplicada | — | **Desconocido** |
+ | Base de datos y esquema del backend | — | **Desconocido** |
+ | Cifras reales de descargas, negocios y activos | contadores de marketing | **Desconocido** |
+ | Existencia de app iOS en desarrollo | — | **Desconocido** |
+ 
+ ---
+ 
+ # 21. Comparativa LaVerde ↔ Cuba Negocios
+ 
+ ## 21.1 La tabla
+ 
+ | Dimensión | **LaVerde** | **Cuba Negocios** |
+ |---|---|---|
+ | **Qué es** | Directorio web + panel de negocio + PWA | App Android de mapa y cartelera |
+ | **Canal principal** | SEO (`/lugares/...`), PWA, WhatsApp, Telegram | Google Play y vendedores comisionados |
+ | **Precio de entrada** | 3,5 USD/mes (pack Esencial) | **2 USD/mes** |
+ | **Precio tope** | 10 USD/mes (Pro) + módulos | **5 USD/mes** (Empresas) |
+ | **Prueba gratuita** | 30 días de Pro | No anunciada |
+ | **Moneda** | USD y CUP (tasa configurable, 780 por defecto) | USD mostrado, cobro en CUP a tasa de la app |
+ | **Pago** | QvaPay + webhook | No observado |
+ | **Catálogo** | Menú/catálogo con «Hoy hay», ofertas, QR | **Cartelera diaria** |
+ | **QR / URL pública de carta** | Sí, QR imprimible sin marca en Menú Pro | **No** |
+ | **Pedidos** | Carrito → WhatsApp | Solo WhatsApp directo |
+ | **Reservas** | Mesa / apartado / cita con aforo | **No** |
+ | **Búsqueda** | Lenguaje natural con IA + pgvector | Categoría, municipio, provincia |
+ | **Mapa** | Leaflet/MapLibre, pines, filtros, cercanía | Mapa de Cuba con filtros administrativos |
+ | **Notificaciones** | Push (web-push), Telegram, internas | **Push nativo a seguidores de un negocio** |
+ | **Gestión del negocio** | Panel web + bot de Telegram | Solo app Android |
+ | **Multinegocio** | Sí, con equipo y permisos por sección | Sí, en plan de 5 USD |
+ | **Importación CSV** | Sí, en catálogo | Sí, en plan de 5 USD |
+ | **Analítica para el negocio** | Visitas, llamadas, seguidores, eventos, export CSV | No observada |
+ | **Verificación** | Sello de negocio verificado (función contratada) | No existe |
+ | **Extras** | Publicaciones para Facebook, ranking, afiliados, eventos | Programa de vendedores con comisión |
+ | **SEO de negocio** | **Sí**, fichas y páginas por categoría/ciudad | **No**, cero fichas públicas |
+ | **Offline** | PWA con snapshots | No (app nativa, sin datos de offline) |
+ | **Plataformas** | Web, PWA, móvil | Android únicamente |
+ | **Stack** | Next.js 16, Neon, Drizzle, QvaPay | WordPress, Express, Flutter |
+ | **Madurez observada** | Producto ancho, mucha función marcada «Próximamente» | Producto estrecho, publicado y funcionando |
+ | **Foso** | Amplitud funcional y SEO | **Canal de venta y app nativa** |
+ | **Debilidad** | Depende de que el dueño entre a un panel web | Sin web, sin transacción, sin búsqueda |
+ 
+ ## 21.2 Los tres ejes donde de verdad se diferencian
+ 
+ **Eje 1 — Producto ancho contra producto estrecho.**
+ LaVerde intenta cubrir el ciclo completo (descubrir → carta → pedir → reservar → avisar → medir) y por eso tiene funciones «Próximamente» que aún no abren. Cuba Negocios cubre **una sola cosa** —que el negocio exista en un mapa y publique lo que tiene hoy— y la cubre entera, desde el alta hasta el push. En un mercado con datos caros y dueños sin tiempo, el producto estrecho y terminado suele ganar al producto ancho e incompleto en la primera venta.
+ 
+ **Eje 2 — SEO contra tienda de apps.**
+ LaVerde compra demanda en Google; Cuba Negocios la compra en Play Store y en la calle. Son canales con economías opuestas: el SEO tiene coste marginal cero y techo alto pero tarda meses; el vendedor comisionado tiene coste por venta y escala con personas pero convierte desde el primer día. LaVerde tiene el canal más barato a largo plazo; Cuba Negocios, el más rápido a corto.
+ 
+ **Eje 3 — Escaparate contra transacción.**
+ Cuba Negocios digitaliza **la vitrina**: qué hay, dónde y a cuánto. LaVerde digitaliza **la venta**: carrito, mensaje, reserva y confirmación. Cuando el cliente ya está mirando la cartelera, la diferencia entre «te escribo por WhatsApp» y «pido en dos toques» es toda la conversión.
+ 
+ ## 21.3 Qué implica para LaVerde
+ 
+ 1. **El precio de entrada es una amenaza real, no teórica.** 2 USD contra 3,5 USD, en un mercado donde el negocio compara en CUP. LaVerde necesita un escalón de entrada que sea «existir y publicar» —sin pedidos ni QR sin marca— para no perder la primera venta contra Cuba Negocios. El pack Esencial sigue siendo mejor producto, pero no se compara con el plan de 2 USD: se compara con «no pagar nada».
+ 2. **El aviso push atado a la cartelera hay que copiarlo, y mejor.** Cuba Negocios ya demostró que el dueño paga por avisar a sus seguidores. LaVerde tiene la infraestructura (push, seguimiento de negocios, Telegram) y no la está vendiendo como función: debería ser «cada vez que actualizas tu carta, tus seguidores se enteran», en todos los planes.
+ 3. **El vendedor comisionado en CUP es el canal que falta.** Los afiliados con código de LaVerde son un descuento; el programa de Cuba Negocios es un empleo. Con 900.000 negocios MiPyme/TCP declarados por ellos mismos, un ejército de vendedores a comisión es la forma más rápida de cubrir el país sin equipo comercial.
+ 4. **El terreno que no se debe ceder es el SEO de negocio y la transacción.** Son justo las dos cosas que Cuba Negocios no puede añadir sin reconstruirse: no tiene fichas públicas ni carrito. Cada página «[categoría] en [ciudad]» y cada pedido cerrado dentro de LaVerde es un punto que el competidor no puede recuperar desde su app.
+ 5. **La app nativa es la deuda pendiente.** No hace falta abandonar la PWA —es la decisión correcta para el cliente con datos caros—, pero el dueño del negocio necesita notificaciones fiables y, si es posible, presencia en Play Store. Es el único terreno donde Cuba Negocios juega con ventaja estructural y donde LaVerde no tiene respuesta hoy.
+ 
+ En una línea: **Cuba Negocios demuestra que en Cuba se vende presencia barata y avisos; LaVerde demuestra que se puede vender la operación completa. LaVerde no debe competir en precio, debe competir en que su plan de 3,5 USD haga cosas que el de 2 USD no puede hacer ni copiando.**
+ 
+ ---
+ 
+ *Documento generado a partir de análisis estático de artefactos púb