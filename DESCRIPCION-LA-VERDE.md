# La Verde — Descripción completa del proyecto

> Documento de contexto para que un asistente entienda el producto, el modelo
> de negocio, las funcionalidades y la arquitectura técnica antes de trabajar
> en el repositorio.

---

## 1. Qué es La Verde

**La Verde** es una plataforma cubana de descubrimiento de lugares y gestión de
negocios locales. Está pensada para que cualquier persona en Cuba encuentre
dónde comer, dormir, comprar o resolver un servicio, y para que los negocios
pequeños tengan una presencia digital real sin depender de Instagram,
Facebook o de saber montar una web.

- **Nombre:** La Verde
- **Dominio de producción:** https://laverde.kynari.dev
- **Idioma del producto:** español (español cubano natural)
- **Público:** usuarios en Cuba con datos móviles limitados; negocios sin WiFi
  propio, muchas veces gestionados desde un teléfono.
- **Propuesta de valor:** una sola ficha para el mapa, la carta, los pedidos,
  las reservas y las redes sociales. Todo ligero, todo desde el móvil.

El nombre juega con la doble lectura de «verde» en Cuba: la naturaleza y la
esperanza, pero también el dinero. El posicionamiento visual es premium pero
accesible, local y auténtico; no corporativo ni de startup genérica.

---

## 2. Objetivo

**Para el usuario:** encontrar el lugar correcto en el menor tiempo posible y
con la menor cantidad de datos móviles, entendiendo las particularidades
cubanas (monedas múltiples, horarios irregulares, apagones, transporte
limitado, barrios).

**Para el negocio:** existir digitalmente y vender más sin necesidad de una
web, de un Community Manager ni de estar conectado todo el día. La ficha, el
catálogo, los pedidos y la comunicación se gestionan desde el móvil, incluso
por Telegram.

**Para La Verde:** construir el directorio de referencia de Cuba y monetizar
con planes mensuales asequibles, módulos sueltos y servicios de visibilidad.

---

## 3. Contexto cubano que el producto asume

- Monedas: CUP, USD, EUR y «USD clásica» (MLC). Un negocio puede aceptar varias.
- Los horarios son irregulares y cambian sin aviso.
- Los apagones son parte del clima: «¿tienen corriente?» es una pregunta real.
- El transporte es limitado: la cercanía importa más que en otros mercados.
- Los datos móviles son caros y escasos: todo debe ser ligero, con soporte
  offline y sin descargas innecesarias.
- Muchos negocios operan desde WhatsApp y grupos de Facebook.
- El pago digital no es trivial: la pasarela usada es QvaPay.

---

## 4. Usuarios y roles

| Rol | Qué puede hacer |
|---|---|
| `user` | Explorar el mapa, buscar con IA, guardar lugares, dejar reseñas, seguir negocios, gestionar su perfil |
| `owner` | Todo lo del usuario y, además, el panel de sus negocios: catálogo, pedidos, reservas, ofertas, publicaciones, asistente, equipo, planes y ajustes |
| `admin` | Panel de administración: negocios, usuarios, categorías, planes y precios, publicaciones, solicitudes, proyectos, soporte, analítica, notificaciones y proveedores de IA |

Un usuario puede ser dueño de varios negocios y cambiar entre ellos. También
puede invitar a otras cuentas al equipo de un negocio, con permisos por
sección.

---

## 5. Producto para el usuario final

### Mapa y exploración
- Mapa interactivo de Cuba con pines por negocio y por categoría.
- Filtros por ciudad, provincia, categoría, moneda, características y estado.
- Geocodificación y búsqueda por cercanía.
- Pines destacados y novedades en el mapa.

### Búsqueda con IA
- Búsqueda en lenguaje natural: «¿dónde comer tacos?», «sitios abiertos
  ahora que acepten USD», «algo cerca de mí con terraza».
- La IA interpreta barrios, monedas, costumbres y contexto cubano.
- Resultados con razonamiento, filtros sugeridos y distancia aproximada.
- Búsqueda vectorial (pgvector) sobre embeddings de los negocios, combinada
  con filtros SQL.
- Prioridad de aparición para negocios con plan.

### Ficha de negocio
- Nombre, descripción, categoría, dirección, ciudad, provincia y barrio.
- Coordenadas, horario, franja horaria y estado (activo, cerrado,
  temporalmente cerrado).
- Teléfono, WhatsApp, Instagram, Facebook y web.
- Métodos de pago y monedas aceptadas.
- Nivel de precio, ambiente, etiquetas y características (WiFi, terraza,
  pet-friendly, vegetariano, enchufes, aire, música, estacionamiento).
- **Energía de respaldo:** ninguna, planta, inversor o ambas, con una nota
  opcional del dueño. Es un filtro real por la realidad cubana.
- Galería de fotos y logotipo.
- Carta/menú digital.
- Reseñas y valoración media.
- Botones de acción: llamar, WhatsApp, cómo llegar, guardar, compartir.
- Sello de «negocio verificado» (solo si la administración lo verificó y el
  negocio tiene la función contratada).
- Indicador de visitas del mes.

### Menú QR / catálogo online
- Carta digital accesible por QR, sin descargar aplicación.
- Productos con nombre, descripción, precio en texto libre, moneda, foto,
  categoría y etiqueta («Popular», «Nuevo», «2x1»).
- Estado «Hoy hay»: disponible o agotado, con opción temporal.
- Sección de ofertas y novedades dentro del catálogo.
- QR con la marca de La Verde en el plan Gratis; QR sin marca con Menú Pro.

### Pedidos y reservas
- Carrito conectado al catálogo y envío del pedido por WhatsApp.
- Reservas por WhatsApp según tipo de negocio:
  - `mesa`: pide personas, fecha y hora, con aforo máximo por reserva y aforo
    diario opcional.
  - `apartado`: pide un producto y cantidad.
  - `cita`: solo fecha y hora.
- Plantilla de mensaje personalizable con huecos `{nombre}`, `{fecha}`,
  `{hora}`, `{personas}`.
- El dueño puede apagar pedidos o reservas sin bajar de plan.

### Cuenta y personalización
- Registro y acceso con Neon Managed Auth (correo y contraseña).
- Onboarding por provincia/ciudad, intereses, monedas y preferencias.
- Perfil con teléfono, ciudad y preferencias.
- Lugares guardados.
- Historial de búsquedas y búsquedas recientes.
- Recomendaciones personalizadas.
- Notificaciones internas y push.
- Seguimiento de negocios: el usuario se conecta con un negocio y recibe
  avisos de sus novedades.
- Programa de afiliados con código de referido y página de «Enlaces».
- PWA instalable, con snapshots offline para zonas de mala conexión.
- Páginas SEO indexables: `/lugares`, `/lugares/[categoria]`,
  `/lugares/ciudad/[ciudad]`, `/lugares/[categoria]/[ciudad]`, fichas
  individuales y datos estructurados.
- Ranking mensual de negocios.

### Proyectos y eventos
- Los usuarios pueden enviar solicitudes de proyectos (eventos, ferias,
  actividades) con nombre, descripción, contacto, teléfonos, redes,
  provincias, local, fechas, paquetes de oferta, imágenes y portada.
- La administración las revisa, aprueba o rechaza.
- Los eventos y el «destacar pin» están dentro del catálogo de funciones,
  marcados como **Próximamente** hasta que la funcionalidad esté completa.

---

## 6. Producto para negocios

El panel del negocio se organiza en estas secciones:

| Sección | Funciones |
|---|---|
| **Dashboard** | Resumen de visitas, llamadas, seguidores y estado del plan |
| **Catálogo** | Productos, fotos, precios, categorías, «Hoy hay», importación CSV |
| **Pedidos** | Pedidos recibidos por WhatsApp y su estado |
| **Editor** | Edición de la ficha: datos, contacto, horario, fotos, logotipo, energía, reservas |
| **Ofertas** | Ofertas y novedades dentro del catálogo |
| **Publicar** | Generación de publicaciones para grupos de Facebook, usando el catálogo como contexto, con límite semanal |
| **Asistente** | Bot de Telegram para actualizar el menú y consultar el negocio; capa de IA en Pro |
| **Equipo** | Invitaciones y permisos por sección para trabajadores |
| **Planes** | Contratación de packs/módulos, estado, vigencia y pagos |
| **Ajustes** | Pedidos, reservas, tipos de reserva, aforos, plantilla, verificación y preferencias |

### Gestión desde Telegram
- El dueño vincula su negocio con el bot.
- Puede actualizar el menú con comandos y botones en tiempo real.
- Con el módulo de asistente, también puede hablar en lenguaje natural.
- Los usuarios pueden seguir el negocio desde la ficha y recibir avisos por
  Telegram.

### Visibilidad y marketing
- Publicaciones automáticas o asistidas para grupos de Facebook: 1 o 3 por
  semana según el módulo o pack.
- Generación del texto con IA a partir del catálogo.
- Flyers publicitarios (próximamente).
- Ofertas flash dentro del catálogo.
- Avisos push y de Telegram a seguidores.
- Ranking mensual con descuento.
- Eventos y pin destacado (próximamente).
- Cupones por WhatsApp, reporte mensual y estadísticas avanzadas
  (próximamente o exclusivas de Pro).

### Equipo
- Invitaciones por enlace.
- Permisos por sección: un trabajador no ve pestañas que no puede usar.
- Control de acceso siempre en el servidor.

---

## 7. Planes y precios

El modelo no es una escalera rígida. Tiene **tres piezas** que se combinan:

1. **Gratis:** lo que ya tiene cualquier negocio que aparezca en La Verde.
2. **Módulos sueltos:** se contratan por separado, cada uno con su precio y su
   vigencia mensual.
3. **Packs:** conjuntos de funciones con descuento.

Un negocio puede tener un pack **y** módulos sueltos a la vez. Una función se
abre si la trae cualquiera de las piezas contratadas.

**Regla clave:** un plan no borra datos. Bajar de plan solo deja de permitir y
de mostrar; lo que el negocio ya escribió sigue guardado y vuelve si vuelve a
subir.

### 7.1 Plan Gratis — 0 USD

- Pin en el mapa de La Verde.
- Ficha de negocio completa.
- Catálogo online limitado a **15 productos**.
- Fotos en productos y servicios (**10 fotos** en el plan Gratis puro).
- Búsquedas con IA para encontrar el negocio.
- Indicador de respaldo energético.
- Contador de visitas del mes.

Los topes de productos y fotos son antiabuso, no una frontera comercial: en
cuanto el negocio contrata cualquier módulo o pack, dejan de aplicar.

### 7.2 Packs

| Pack | Precio | Lema | Qué incluye |
|---|---:|---|---|
| **Esencial** | **3,5 USD/mes** | «Para vender sin perder clientes.» | Todo Gratis + Menú Pro (QR sin marca, ofertas, productos y fotos ilimitados) + actualización del menú por Telegram + pedidos por WhatsApp + reservas + 1 publicación semanal en Facebook + avisos a seguidores |
| **Publicidad Max** | **6 USD/mes** | «Para que te vean.» | Todo Gratis + 3 publicaciones semanales en Facebook + eventos + avisos a seguidores |
| **Pro** | **10 USD/mes** | «Todo, sin depender de nadie.» | Todo Esencial + todo Publicidad Max + asistente de IA por Telegram + ranking mensual + estadísticas completas + soporte prioritario por WhatsApp |

### 7.3 Módulos sueltos

| Módulo | Precio | Lema | Qué incluye |
|---|---:|---|---|
| **Menú Pro** | **1 USD/mes** | «Tu carta, sin nuestra marca.» | QR imprimible sin marca, productos ilimitados, fotos ilimitadas, ofertas/novedades y «Hoy hay» |
| **Reservas y pedidos** | **1,5 USD/mes** | «Que te pidan sin preguntar.» | Todo Menú Pro + pedidos por WhatsApp conectados al catálogo + reservas por capacidad |
| **Facebook** | **1 USD/mes** | «Tu negocio en los grupos de tu zona.» | Texto generado con IA, catálogo como contexto, 1 publicación semanal, flyers (próximamente) |
| **Facebook ×3** | **3 USD/mes** | «Tres veces más veces visto.» | Lo anterior con 3 publicaciones semanales |
| **Eventos** | **3 USD/mes** | «Llena lo que montes.» | Eventos por rango de fechas, promoción en canales oficiales, avisos a usuarios recurrentes, pin destacado durante el evento |
| **Agente de Telegram** | **3 USD/mes** | «Tu menú, desde el móvil, hablando.» | Consultas con IA sobre el negocio, edición instantánea del menú, actualización de estados |

### 7.4 Prueba y facturación

- **30 días de prueba de Pro** para cada negocio nuevo.
- Durante la prueba, el negocio tiene todas las funciones de Pro.
- Pasada la prueba, cae al pack contratado; si no contrató ninguno, a Gratis.
- Los precios están acordados en USD y se muestran también en CUP.
- **Tasa de conversión por defecto: 780 CUP por USD**, configurable desde el
  panel de administración.
- Los precios y textos del catálogo se pueden editar desde `/admin/planes`;
  el código guarda los valores por defecto.
- **Pasarela de pago: QvaPay.**
  - El servidor crea la factura y guarda el intento en la tabla `pagos`.
  - El webhook marca el pago como pagado y aplica el derecho en una sola
    transacción.
  - El precio lo calcula siempre el servidor; el cliente solo dice qué quiere
    contratar.
- **Recordatorios de pago:**
  - Aviso 5 días antes del vencimiento.
  - Aviso el día anterior.
  - Aviso si venció ayer, con hasta 3 días de gracia y una sola vez.
  - Se envían por push, correo y bandeja interna.
- Descuentos manuales por negocio (0–100 %) desde administración.
- Cancelar corta el acceso en el acto, sin borrar el historial.

### 7.5 Estados y reglas de suscripción

- `gratis` no es un pack contratado: es la ausencia de pack.
- Sin fila de suscripción = Gratis (defecto seguro).
- Suscripción cancelada = Gratis inmediato.
- Pack vencido = Gratis.
- Un módulo suelto puede seguir vigente aunque el pack haya vencido.
- Una función puede venir por módulo, por pack o por prueba; basta con una vía.
- Las funciones marcadas «Próximamente» se venden desde ya, pero el candado no
  se abre hasta que existan de verdad.

---

## 8. Panel de administración

Secciones principales:

| Sección | Funciones |
|---|---|
| **Negocios** | Listado, alta, edición, importación, publicación, verificación, boost, plan y suscripción |
| **Usuarios** | Roles, cuentas y datos de contacto |
| **Categorías** | Alta, edición e iconos |
| **Planes** | Edición del catálogo completo: precios, textos, funciones y tasa CUP |
| **Publicaciones** | Revisión y gestión de publicaciones de Facebook |
| **Solicitudes** | Solicitudes de usuarios y proyectos |
| **Proyectos** | Revisión, aprobación y rechazo de eventos/proyectos |
| **Soporte** | Tickets de soporte |
| **Analítica** | Visitas, llamadas, búsquedas, demanda, exportación CSV |
| **Notificaciones** | Broadcast a usuarios y negocios |
| **Proveedores de IA** | Configuración de proveedores y modelos |

La analítica registra eventos (visitas, llamadas, búsquedas, guardados,
clics), los agrega por periodo y negocio, y permite exportar datos. También
hay un cron de agregación.

---

## 9. Arquitectura técnica

### Stack

- **Framework:** Next.js 16, App Router, React 19, TypeScript 5.7.
- **Bundler:** Turbopack (build y dev).
- **Base de datos:** Neon Postgres serverless con `@neondatabase/serverless`
  y `drizzle-orm`.
- **Auth:** Neon Managed Better Auth (`@neondatabase/auth` 0.5.0-beta), que
  exige Next >= 16.
- **Estilos:** Tailwind CSS 3.4 + Radix UI.
- **Iconos:** `lucide-react`.
- **Animación:** `motion`.
- **Notificaciones:** `sonner` y `sileo`.
- **Mapa:** Leaflet + react-leaflet.
- **IA:** AI SDK con proveedores configurables; el modelo por defecto es
  `mistral-small-latest` (configurable por variable). Cloudflare Workers AI y
  proveedores administrables.
- **Email:** Resend.
- **Push:** `web-push`.
- **Almacenamiento:** S3 / Neon Storage.
- **Analítica de producto:** PostHog.
- **Pagos:** QvaPay.
- **PWA:** manifest, service worker y snapshots offline.

### Estructura

- `src/app/` — rutas App Router, APIs y páginas.
- `src/components/` — UI por dominio: landing, mapa, lugar, negocio, perfil,
  admin, onboarding, layout, ui.
- `src/lib/` — lógica de dominio: planes, permisos, IA, analítica, reservas,
  pedidos, push, email, recordatorios, storage, auth.
- `src/lib/db/schema/` — un archivo por tabla de Drizzle.
- `src/lib/db/migrations/` — migraciones SQL y metadatos de Drizzle.
- `src/config/site.ts` — configuración global del sitio.
- `src/proxy.ts` — sustituye al antiguo middleware; corre en Node, no en Edge.
- Alias `@/*` → `src/*`.

### Autenticación y permisos

- Neon guarda la cuenta; la tabla `users` guarda el perfil y el rol.
- `src/lib/auth/user.ts` busca o crea la fila del usuario a partir de
  `authUserId`.
- `src/proxy.ts` comprueba solo que hay sesión.
- El rol se comprueba en el layout de `/admin` y `/business`.
- El navegador nunca habla directamente con Neon: todas las llamadas van a
  `/api/auth/*` y el catch-all del servidor proxea a Neon.
- El primer administrador se crea con `AUTH_BOOTSTRAP_ROLES`.
- Las rutas de API validan permisos de plan siempre en el servidor; nunca se
  confía en el cliente.

### Principios de ingeniería

- Cambios mínimos y reutilización de lo existente.
- Validación server-side siempre.
- Migraciones con Drizzle.
- UI en español.
- Renderizado ligero y compatible con datos móviles limitados.
- Código y comentarios en español.
- Verificar contra el código instalado, no contra la documentación.
- No añadir dependencias salvo que sean imprescindibles.

---

## 10. Principios de producto

1. **Ligero primero.** Cada kilobyte cuenta para un usuario con datos móviles.
2. **Móvil primero.** El dueño gestiona el negocio desde el teléfono.
3. **Funciona con mala conexión.** PWA, snapshots offline y degradación
   elegante.
4. **Habla cubano.** Monedas múltiples, apagones, barrios, horarios
   irregulares y cercanía.
5. **El negocio manda en su ficha.** La marca de La Verde no debe tapar el
   nombre del negocio.
6. **Una línea por tarjeta.** En el panel, cada función se explica con una
   sola línea de apoyo, no con párrafos.
7. **Un plan no borra datos.** Degradar permisos no destruye contenido.
8. **El servidor decide.** Los permisos y los precios se calculan en el
   servidor.
9. **Próximamente se vende, pero no se abre.** Las funciones futuras se pueden
   contratar y se muestran con candado.

---

## 11. Estado actual y hoja de ruta

### Implementado
- Mapa, búsqueda con IA, fichas, reseñas, guardados y perfiles.
- Catálogo/menú QR, fotos, «Hoy hay», ofertas.
- Pedidos y reservas por WhatsApp.
- Publicaciones para Facebook.
- Asistente de Telegram.
- Equipo e invitaciones.
- Planes, módulos, packs, prueba de 30 días, permisos y límites.
- Pagos con QvaPay y recordatorios de pago.
- Analítica, admin, soporte, solicitudes y proyectos.
- Notificaciones internas, push y seguimiento de negocios.
- PWA, offline, SEO, sitemap y datos estructurados.
- Ranking mensual.
- Afiliados.

### Marcado como «Próximamente»
- Eventos completos y pin destacado durante el evento.
- Flyers automáticos (hasta 10 al mes).
- Cupones por WhatsApp.
- Reporte mensual de resultados.

### Notas para quien trabaje en el repo
- El proyecto está en español. Responder y escribir en español.
- El estilo de trabajo es deliberadamente austero: pocas dependencias, código
  corto, reutilizar antes de crear.
- No confiar en el cliente para permisos ni precios.
- Respetar el esquema de planes: `src/lib/plans.ts` es la única fuente de
  verdad de funciones, módulos, packs, límites y precios por defecto.
- El catálogo vivo puede estar editado en base de datos; el código solo
  contiene los valores de fábrica.
- Antes de tocar una API de terceros, leer el código instalado en
  `node_modules`.
