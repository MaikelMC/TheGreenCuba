# PROMPT MAESTRO — AUDITORÍA, SEO, AEO, DISCOVERY Y GROWTH DE LA VERDE

Actúa como un equipo senior compuesto por:

- Technical SEO Specialist
- Local SEO Specialist
- AEO / AI Search Specialist
- Growth Engineer
- Information Architect
- Performance Engineer
- CRO/Product Growth Specialist
- Content/Entity SEO Strategist
- Web Security Engineer

Tu metodología obligatoria es:

**AUDITAR → DETECTAR → PRIORIZAR → IMPLEMENTAR → VALIDAR → DOCUMENTAR**

No quiero un informe teórico. Quiero que inspecciones el repositorio real y, cuando sea posible y seguro, IMPLEMENTES las mejoras directamente en el código.

---

# 0. CONTEXTO ACTUAL Y FUENTE DE VERDAD

## Producto

**Nombre:** La Verde

**Mensaje principal actual:**
> Escribe lo que buscas. La Verde te lleva.

**Posicionamiento:**
> La forma más inteligente de descubrir lugares en Cuba.

La Verde es una plataforma web de descubrimiento de lugares en Cuba.

No debe comunicarse como un simple directorio, listado o Google Maps.

La experiencia combina:

- búsqueda en lenguaje natural;
- Inteligencia Artificial;
- ubicación;
- mapa interactivo;
- horarios;
- precios;
- monedas;
- métodos de pago;
- contexto cubano;
- preferencias;
- necesidades;
- recomendaciones;
- datos reales de lugares.

Ejemplos de búsquedas:

- “un café tranquilo cerca de mí”
- “dónde comer rico esta noche con la jeva”
- “algo barato”
- “un sitio que acepte transferencia”
- “me hace falta arroz y cárnico en CUP”
- búsquedas que combinen ubicación + presupuesto + horario + categoría + método de pago.

## Problema

En Cuba, las soluciones tradicionales no siempre responden a la pregunta realmente importante:

> **“¿A dónde voy ahora mismo?”**

Problemas relevantes:

- información de apertura poco confiable;
- monedas aceptadas;
- CUP / USD / MLC;
- transferencias;
- horarios cambiantes;
- dificultad para descubrir lugares;
- dificultad para buscar por necesidad;
- recomendaciones poco contextualizadas;
- lenguaje local que los buscadores tradicionales no interpretan bien.

## Diferenciadores no negociables

1. IA + lenguaje natural.
2. Contexto cubano.
3. Recomendaciones contextualizadas.
4. Datos reales.
5. Descubrimiento por necesidad.
6. Recomendaciones basadas en mérito, no solamente en publicidad.
7. Dos lados del producto: usuarios y negocios.
8. Experiencia rápida con conectividad limitada.
9. No posicionarla como un simple mapa/directorio.

Principio de marca:

> **No es publicidad pagada: lo bueno aparece porque lo merece.**

## Usuarios

### Usuarios finales
Personas en Cuba que necesitan decidir rápidamente dónde ir, qué hacer, qué comprar o qué servicio utilizar.

### Negocios
Cafeterías, restaurantes, bares, discotecas, mercados, tiendas y servicios locales que quieren visibilidad, visitas cualificadas e insights.

## Estado actual

La Verde es actualmente **web**. No existe una app móvil nativa.

Stack conocido:
- Next.js
- Node.js
- PostgreSQL

**Producción actual:**
https://laverde.kynari.dev

Existe/ha existido una preview de validación:
https://laverde-two.vercel.app/

La preview histórica no debe tratarse automáticamente como la URL canónica de producción. Determina desde el código cuál debe ser la URL canónica actual y evita contenido duplicado entre preview y producción.

## Estrategia de crecimiento existente

La estrategia general combina:

**Discovery + SEO + AEO + redes sociales**

La estrategia de contenido sigue:

**Presentación → Educación → Utilidad → Descubrimiento → Comunidad → Conversión**

Pilares de contenido:
- Descubrimiento: 35%
- Problemas reales: 25%
- Educación: 20%
- Marca/comunidad: 20%

Mensaje central:
> **Escribe lo que buscas. La Verde te lleva.**

---

# 1. OBJETIVO PRINCIPAL DE ESTA AUDITORÍA

El objetivo no es simplemente “hacer SEO”.

Queremos construir este sistema:

**NECESIDAD → DISCOVERY → SEARCH → SEO → AEO/AI SEARCH → LA VERDE → EXPLORACIÓN → RECOMENDACIÓN → ACCIÓN → RETENCIÓN**

La pregunta central que debes responder durante toda la auditoría es:

> **¿Cómo puede una persona que NO conoce La Verde encontrarla cuando busca resolver una necesidad real en Cuba?**

---

# 2. INSPECCIÓN INICIAL OBLIGATORIA

Antes de cambiar nada:

1. inspecciona toda la estructura del repositorio;
2. identifica framework y versión;
3. identifica routing;
4. identifica páginas públicas;
5. identifica páginas privadas;
6. identifica componentes;
7. identifica fuentes de datos;
8. identifica modelo de lugares;
9. identifica campos disponibles de cada lugar;
10. identifica cómo se generan las fichas;
11. identifica cómo funciona la búsqueda;
12. identifica cómo funciona la IA;
13. identifica cómo funciona el mapa;
14. identifica autenticación;
15. identifica dashboards;
16. identifica variables de entorno;
17. identifica configuración de deployment;
18. identifica metadata existente;
19. identifica sitemap/robots;
20. identifica analytics existentes;
21. identifica errores y deuda técnica relevante.

No asumas que una funcionalidad existe solamente porque aparece en este prompt.

Si el código demuestra que algo aún no existe, documenta la diferencia entre visión y estado real.

---

# 3. DISCOVERY — PRIORIDAD MÁXIMA

Diseña el sistema de descubrimiento de La Verde alrededor de necesidades reales.

Investiga oportunidades como:

### Lugares
- restaurantes;
- cafeterías;
- bares;
- discotecas;
- mercados;
- tiendas;
- servicios;
- lugares para citas;
- lugares para trabajar;
- lugares para salir;
- lugares económicos.

### Situaciones
- cerca de mí;
- abierto ahora;
- esta noche;
- fin de semana;
- para una cita;
- con amigos;
- algo tranquilo;
- algo barato;
- algo rápido.

### Restricciones
- acepta transferencia;
- acepta CUP;
- acepta USD;
- acepta MLC;
- precio;
- horario;
- ubicación.

### Intención local
- ciudad;
- municipio;
- zona;
- barrio;
- categoría;
- atributos.

Construye un mapa de oportunidades basado en la arquitectura y datos reales del proyecto.

No inventes volúmenes de búsqueda.

Si no puedes medir un volumen, dilo.

---

# 4. SEARCH INTENT

Clasifica oportunidades en:

- navegacional;
- informacional;
- comercial;
- transaccional;
- local;
- contextual;
- urgente;
- problem-aware;
- solution-aware;
- brand-aware.

Para cada oportunidad determina:

- intención;
- usuario;
- consulta posible;
- página ideal;
- contenido necesario;
- CTA;
- posibilidad de indexación.

---

# 5. ARQUITECTURA SEO DE LA VERDE

Evalúa y, si tiene sentido, implementa una arquitectura como:

**La Verde → Cuba → Ciudad → Zona → Categoría → Lugar**

Ejemplos potenciales:

`/lugares/[ciudad]`

`/lugares/[ciudad]/[categoria]`

`/lugares/[ciudad]/[categoria]/[slug]`

Pero NO implementes estas rutas literalmente si la arquitectura real necesita otra solución.

La prioridad es la lógica, no copiar una estructura.

El sistema debe permitir que las páginas públicas importantes sean descubribles mediante enlaces HTML normales.

---

# 6. PÁGINAS DE LUGARES COMO ACTIVOS SEO

Una ficha pública suficientemente completa puede convertirse en una puerta de entrada orgánica.

Audita si cada ficha puede exponer, cuando exista realmente:

- nombre;
- categoría;
- descripción;
- dirección;
- ciudad;
- zona;
- coordenadas;
- horarios;
- teléfono;
- sitio web;
- redes sociales;
- rango de precio;
- moneda;
- métodos de pago;
- imágenes;
- atributos;
- menú;
- servicios;
- reseñas;
- información adicional.

### Regla crítica

No inventes:

- precios;
- horarios;
- monedas;
- métodos de pago;
- reseñas;
- fotografías;
- servicios;
- puntuaciones;
- direcciones.

Si la información puede quedar obsoleta, evalúa mecanismos de frescura:

- fecha de actualización;
- última verificación;
- fuente;
- estado de información;
- actualización por negocio;
- actualización administrativa.

Esto es especialmente importante para horarios, precios y métodos de pago en el contexto cubano.

---

# 7. PROGRAMMATIC SEO

Evalúa la generación de páginas públicas útiles a partir de datos reales.

Posibles dimensiones:

- ciudades;
- zonas;
- categorías;
- lugares;
- atributos;
- métodos de pago;
- ocasiones;
- necesidades.

No generes páginas combinatorias sin contenido real.

Ejemplo de mala estrategia:

> Crear cientos de URLs de “restaurantes + ciudad + atributo” sin suficientes lugares o contenido.

Ejemplo de buena estrategia:

> Crear una página solamente cuando pueda responder de forma útil una intención real con datos suficientes.

---

# 8. INDEXACIÓN

Define explícitamente qué debe ser indexable.

## Potencialmente indexable

- home;
- ciudades;
- categorías;
- zonas con contenido suficiente;
- fichas públicas de lugares;
- landings de necesidades con contenido real;
- contenido editorial;
- páginas públicas para negocios si tienen valor para usuarios.

## No indexable

- dashboard;
- administración;
- configuración;
- perfil privado;
- historial;
- búsquedas privadas;
- preferencias privadas;
- endpoints;
- APIs;
- datos internos;
- estados internos;
- páginas sin valor para búsqueda.

### Regla crítica

Nunca permitas que consultas personalizadas, historial o información privada del usuario sean indexados accidentalmente.

---

# 9. PREVIEW VS PRODUCCIÓN

Audita específicamente:

- `laverde.kynari.dev`
- `laverde-two.vercel.app`

Determina:

1. cuál es la URL canónica;
2. si la preview está indexable;
3. si hay duplicación;
4. si hay canonical incorrecto;
5. si robots permite crawling;
6. si hay metadata duplicada;
7. si hay enlaces internos apuntando a preview;
8. si la preview debe bloquearse de indexación;
9. si existe contenido que debe migrarse.

No dejes dos versiones públicas compitiendo por las mismas páginas.

---

# 10. RENDERING Y JAVASCRIPT SEO

La Verde depende de una experiencia interactiva.

Eso NO significa que toda la información tenga que depender del cliente.

Audita:

- SSR;
- SSG;
- ISR;
- prerendering;
- HTML inicial;
- metadata server-side;
- contenido crítico;
- JavaScript;
- hydration.

Google debe poder comprender información importante de las páginas públicas sin depender exclusivamente de interacciones del usuario.

Especial atención a:

- nombre del lugar;
- categoría;
- ciudad;
- descripción;
- dirección;
- horarios;
- precios;
- métodos de pago;
- contenido textual.

---

# 11. MAPA Y SEO

El mapa es una funcionalidad central, pero no puede ser el único mecanismo de descubrimiento.

Una página pública debe poder comunicar información relevante aunque el usuario no interactúe con el mapa.

Evalúa:

- accesibilidad;
- HTML;
- enlaces;
- navegación;
- contenido textual;
- indexabilidad;
- performance.

El mapa no debe bloquear la carga de la información principal.

---

# 12. SEO TÉCNICO

Audita e implementa:

- robots.txt;
- sitemap.xml;
- sitemap index si es necesario;
- canonical;
- hreflang solo si realmente aplica;
- index/noindex;
- redirects;
- 404/410;
- URLs;
- trailing slash;
- parámetros;
- paginación;
- metadata;
- headings;
- enlaces internos;
- imágenes;
- alt text;
- Open Graph;
- Twitter/X cards;
- favicon;
- breadcrumbs;
- páginas huérfanas;
- contenido duplicado;
- errores HTTP;
- respuestas de servidor;
- caching.

---

# 13. SITEMAP

El sitemap debe representar solamente URLs públicas que realmente quieras que los buscadores descubran.

Evalúa:

- inclusión/exclusión;
- `lastmod`;
- URLs canónicas;
- páginas no indexables;
- páginas privadas;
- preview;
- frecuencia de actualización.

Si el proyecto tiene suficientes fichas públicas, considera sitemaps separados por tipo:

- lugares;
- ciudades;
- categorías;
- contenido.

No lo hagas si la escala actual no lo justifica.

---

# 14. LOCAL SEO Y ENTITY SEO

La Verde tiene un componente geográfico extremadamente importante.

Construye relaciones semánticas claras entre:

**La Verde → Cuba → ciudad → zona → categoría → lugar**

Y:

**Lugar → categoría → atributos → ubicación → métodos de pago → horarios**

Audita consistencia de nombres, direcciones, categorías y entidades.

No confundas el SEO de La Verde como plataforma con el SEO de los negocios que aparecen dentro de ella.

---

# 15. STRUCTURED DATA

Evalúa Schema.org según el contenido real.

Posibles tipos:

- Organization;
- WebSite;
- WebPage;
- BreadcrumbList;
- LocalBusiness;
- Restaurant;
- FoodEstablishment;
- Store;
- Service;
- SoftwareApplication si corresponde.

No marques todo como `Restaurant`.

Selecciona el tipo correcto según el negocio.

Los datos estructurados deben coincidir con el contenido visible y real.

Valida con herramientas apropiadas.

No prometas resultados enriquecidos: el marcado correcto no garantiza que Google lo muestre.

---

# 16. AEO / AI SEARCH

No trates AEO como “meter keywords para ChatGPT”.

La prioridad es que La Verde sea:

- clara;
- entendible;
- estructurada;
- rastreable;
- consistente;
- verificable;
- útil;
- citable por sistemas de respuesta.

Optimiza:

- definiciones claras;
- respuestas directas;
- entidades;
- relaciones;
- contenido contextual;
- páginas públicas;
- datos consistentes;
- FAQ reales;
- encabezados claros;
- contenido semántico.

### Importante

No inventes ni prometas que La Verde aparecerá en ChatGPT, Gemini, Perplexity, Copilot u otro sistema.

No existe una garantía de “registrar la web en una IA” para conseguir aparición.

La estrategia debe mejorar la capacidad de los sistemas de entender y encontrar el contenido público.

---

# 17. CONTENT DISCOVERY

El contenido editorial debe responder necesidades reales.

Ejemplos:

- “Dónde comer en La Habana”
- “Cafeterías tranquilas en La Habana”
- “Lugares para una cita”
- “Dónde salir este fin de semana”
- “Dónde encontrar opciones económicas”
- “Lugares que aceptan transferencia”

Pero solo crear páginas cuando haya:

- datos;
- contenido;
- utilidad;
- intención;
- posibilidad real de mantenerlas actualizadas.

---

# 18. SOCIAL DISCOVERY

La estrategia social existente incluye:

### Descubrimiento — 35%
### Problemas reales — 25%
### Educación — 20%
### Marca/comunidad — 20%

Evalúa cómo conectar las redes con páginas públicas específicas.

No uses siempre la home.

Ejemplo:

Un Reel sobre:

> “5 lugares para una cita tranquila en La Habana”

debe poder llevar a una landing relacionada si existe.

---

# 19. OPEN GRAPH Y SHARING

Cada URL pública importante debe poder compartirse correctamente.

Audita:

- OG title;
- OG description;
- OG image;
- Twitter/X;
- favicon;
- preview;
- canonical.

Especial atención a fichas de lugares.

Compartir una ficha debería producir una preview útil y coherente.

---

# 20. ANALYTICS Y ATTRIBUTION

Necesitamos saber:

- de dónde llega la gente;
- qué página aterrizó;
- qué buscó;
- qué lugar vio;
- qué filtros utilizó;
- qué recomendación recibió;
- qué acción realizó;
- si volvió.

Audita/implementa eventos útiles.

Como mínimo evalúa:

- `page_view`;
- `search`;
- `ai_search`;
- `place_view`;
- `filter_use`;
- `map_interaction`;
- `share`;
- `call`;
- `whatsapp_click`;
- `website_click`;
- `save_place`;
- `business_signup`;
- `waitlist_signup`;
- conversiones relevantes.

No inventes eventos si el producto no puede producirlos correctamente.

---

# 21. SOURCE / MEDIUM / CAMPAIGN

Prepara el sistema para distinguir:

- Google organic;
- Bing organic;
- Instagram;
- Facebook;
- TikTok;
- WhatsApp;
- referrals;
- enlaces directos;
- campañas;
- QR;
- contenido específico.

Usa UTM cuando corresponda.

No dependas únicamente del “referrer”, porque parte del tráfico puede aparecer como Direct / None.

---

# 22. PERFORMANCE PARA CUBA

Esta sección es crítica.

Optimiza para:

- móviles;
- conexiones lentas;
- poco ancho de banda;
- carga inicial pequeña;
- imágenes optimizadas;
- fuentes eficientes;
- JavaScript reducido;
- lazy loading;
- caching;
- compresión;
- requests mínimos;
- mapa diferido cuando sea posible;
- degradación elegante.

La experiencia principal debe seguir siendo útil incluso si elementos secundarios tardan.

---

# 23. PWA / APP / ASO

Actualmente La Verde es web.

Por tanto:

**ASO no es una prioridad actual.**

Puedes evaluar:

- PWA;
- instalación web;
- arquitectura reutilizable para futura app;
- deep links futuros.

No inventes una estrategia ASO para una app que todavía no existe.

---

# 24. CONVERSIÓN

Audita dos funnels.

## Usuario

**Descubre → busca → explora → compara → decide → visita/contacta/guarda**

## Negocio

**Descubre La Verde → entiende beneficio → registra negocio → completa ficha → recibe exposición → consulta insights**

La propuesta de valor y CTA deben ser distintos según el público.

---

# 25. SEGURIDAD

Audita:

- autenticación;
- autorización;
- endpoints;
- APIs;
- inputs;
- búsquedas;
- formularios;
- datos privados;
- variables de entorno;
- secretos;
- headers;
- dependencias;
- exposición de información;
- robots de endpoints sensibles.

Nunca expongas secretos.

Nunca indexes datos privados.

---

# 26. PRIORIZACIÓN

Clasifica todo:

### P0 — crítico
Bloquea indexación, seguridad, producción o funcionamiento.

### P1 — alto
Impacta fuertemente discovery, SEO, AEO, conversión o performance.

### P2 — medio
Mejora significativa pero no bloqueante.

### P3 — mejora
Optimización futura.

Para cada hallazgo:

- problema;
- evidencia;
- impacto;
- solución;
- dificultad;
- prioridad;
- estado.

---

# 27. IMPLEMENTACIÓN

Implementa directamente todo lo que puedas.

Antes de terminar:

- ejecuta build;
- lint;
- tests disponibles;
- revisa rutas;
- revisa metadata;
- revisa canonical;
- revisa sitemap;
- revisa robots;
- revisa structured data;
- revisa Open Graph;
- revisa rendering;
- revisa performance.

No afirmes que algo está implementado si no fue comprobado.

---

# 28. VALIDACIÓN FINAL

Comprueba como mínimo:

### Home
- indexable;
- canonical;
- title;
- description;
- OG;
- schema;
- rendimiento.

### Ciudad
- indexable;
- contenido útil;
- enlaces;
- schema;
- canonical.

### Categoría
- contenido;
- enlaces;
- indexación;
- metadata.

### Lugar
- datos reales;
- HTML visible;
- metadata;
- canonical;
- schema;
- OG;
- enlaces relacionados.

### Privado
- noindex o protección adecuada;
- no exposición pública;
- no aparición en sitemap.

---

# 29. ACCIONES EXTERNAS

No inventes acceso a ninguna plataforma.

Si necesitas:

- Google Search Console;
- Google Analytics;
- Bing Webmaster Tools;
- IndexNow;
- dominio/DNS;
- Vercel;
- redes sociales;
- APIs;
- otras plataformas;

documenta exactamente qué debe hacer el propietario.

---

# 30. RESTRICCIONES ABSOLUTAS

Nunca:

- inventes negocios;
- inventes horarios;
- inventes precios;
- inventes monedas;
- inventes métodos de pago;
- inventes reseñas;
- inventes estadísticas;
- inventes keywords;
- inventes volumen de búsqueda;
- inventes backlinks;
- inventes indexación;
- inventes citas de IA;
- inventes resultados;
- generes páginas thin;
- indexes búsquedas privadas;
- expongas secretos;
- afirmes acceso externo inexistente.

---

# 31. INFORME FINAL OBLIGATORIO

Entrega:

1. Resumen ejecutivo.
2. Estado real del producto.
3. Discovery.
4. Search Intent.
5. Arquitectura SEO.
6. SEO local.
7. Entity SEO.
8. Páginas de lugares.
9. Programmatic SEO.
10. Indexación.
11. Preview vs producción.
12. Rendering.
13. SEO técnico.
14. Sitemap.
15. Structured Data.
16. AEO / AI Search.
17. Content Discovery.
18. Social Discovery.
19. Open Graph / sharing.
20. Analytics.
21. Attribution.
22. Performance.
23. PWA/App/ASO.
24. Conversión.
25. Seguridad.
26. Cambios realizados.
27. Archivos modificados.
28. Validaciones ejecutadas.
29. Problemas pendientes.
30. Acciones manuales.
31. Roadmap P0/P1/P2/P3.

## FORMATO DE ACCIONES MANUALES

Para cada acción:

**Plataforma:**  
**Objetivo:**  
**URL:**  
**Paso a paso:**  
**Valor exacto:**  
**Dónde obtenerlo:**  
**Cómo verificarlo:**  
**Prioridad:**  
**Estado:**

---

# PRINCIPIO FINAL

No optimices La Verde únicamente para “Google”.

Optimízala para que pueda ser:

**DESCUBIERTA → RASTREADA → ENTENDIDA → INDEXADA → MOSTRADA → VISITADA → UTILIZADA → COMPARTIDA → RECORDADA**

Y haz que cada mejora contribuya al objetivo central:

> **Una persona escribe lo que necesita y La Verde se convierte en una respuesta útil para esa necesidad en Cuba.**
