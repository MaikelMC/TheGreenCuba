# PROMPT — AUDITORÍA Y OPTIMIZACIÓN PROFESIONAL DE LA VERDE

Actúa como Senior Technical SEO, Local SEO Specialist, AEO Specialist, Growth Engineer, especialista en arquitectura de información, performance, CRO, producto y seguridad web.

## METODOLOGÍA
**AUDITAR → DETECTAR → PRIORIZAR → IMPLEMENTAR → VALIDAR → DOCUMENTAR**

Inspecciona el proyecto real y modifica el código cuando sea posible.

## CONTEXTO
**Nombre:** La Verde  
**Tagline:** La forma más inteligente de descubrir lugares en Cuba.

La Verde es una plataforma **web** para descubrir cafés, restaurantes, discos, mercados, servicios y otros lugares en Cuba. Combina mapa interactivo, búsqueda mediante lenguaje natural, IA, ubicación, preferencias y recomendaciones.

No debe posicionarse como otro directorio o Google Maps. Su diferencial es entender el contexto cubano: monedas, transferencias, horarios cambiantes, recomendaciones reales, lenguaje cotidiano y necesidades concretas.

Ejemplos:
- “un café tranquilo cerca de mí”
- “dónde comer rico esta noche con la jeva”
- “me hace falta arroz y cárnico en CUP”
- “dónde salir esta noche”
- “algo barato que acepte transferencia”

Stack actual:
- Next.js
- Node.js
- PostgreSQL

No existe aplicación móvil nativa actualmente.

## OBJETIVO
Conseguir que alguien que NO conoce La Verde pueda encontrarla al buscar resolver una necesidad local.

**NECESIDAD → DISCOVERY → SEARCH/SEO → AEO/IA/SOCIAL → LA VERDE → EXPLORACIÓN → RECOMENDACIÓN → ACCIÓN → RETENCIÓN**

## AUDITORÍA

### 1. Discovery
Busca oportunidades relacionadas con restaurantes, cafés, bares, mercados, tiendas, servicios, nightlife, citas, precios, horarios, zonas, cercanía, métodos de pago, ocasiones y características.

### 2. Search Intent
Clasifica:
- informacional;
- local;
- comercial;
- transaccional;
- exploratoria;
- contextual;
- urgente.

### 3. Local SEO
Prioridad crítica.

Evalúa arquitectura:
**Cuba → ciudad → zona/municipio → categoría → lugar**

Posibles URLs, solo si la arquitectura real las soporta:
`/lugares/[ciudad]/[categoria]`
`/lugares/[ciudad]/[categoria]/[slug]`

No crees URLs inútiles.

### 4. Páginas de lugares
Cada lugar público y suficientemente completo puede ser una puerta de entrada orgánica.

Usa únicamente datos reales disponibles:
- nombre;
- categoría;
- descripción;
- dirección;
- ubicación;
- ciudad;
- zona;
- horarios;
- teléfono;
- web;
- redes;
- precio;
- moneda;
- métodos de pago;
- imágenes;
- atributos;
- menú;
- reseñas.

No inventes datos.

### 5. Programmatic SEO
Evalúa páginas basadas en datos reales:
- ciudades;
- categorías;
- zonas;
- lugares;
- métodos de pago;
- atributos;
- ocasiones;
- necesidades.

No generes miles de páginas thin.

### 6. Indexación
**Indexar:** lugares públicos, categorías útiles, ciudades, zonas con contenido suficiente, landings útiles y contenido editorial.

**No indexar:** dashboards, administración, páginas privadas, historial personal, búsquedas privadas, endpoints, datos sensibles y estados internos.

Nunca permitas que búsquedas o historial privados sean indexables.

### 7. Rendering
Google debe poder leer la información importante de los lugares. Evalúa SSR, SSG, ISR y prerendering. Corrige contenido crítico que dependa exclusivamente de JavaScript.

### 8. Structured Data
Evalúa:
- LocalBusiness;
- Restaurant;
- FoodEstablishment;
- Store;
- Service;
- BreadcrumbList;
- WebSite;
- WebPage.

Usa solo tipos apropiados y datos visibles/reales.

### 9. AEO
Haz que sea fácil entender:
- qué es La Verde;
- qué problema resuelve;
- dónde opera;
- qué lugares contiene;
- cómo funciona;
- qué la diferencia;
- qué información ofrece cada lugar.

### 10. Entity SEO
Trata La Verde, ciudades, categorías, lugares, negocios y zonas como entidades conectadas.

Arquitectura:
**Ciudad → categoría → zona → lugar**
y cuando corresponda:
**Lugar → categoría → atributos → métodos de pago → ubicación**

### 11. Arquitectura
El mapa NO puede ser el único mecanismo de descubrimiento. Debe existir HTML accesible para ciudades, categorías, zonas y lugares.

### 12. Internal Linking
Conecta ciudad, categoría, zona, lugares, contenidos y landings. Evita páginas huérfanas.

### 13. Discovery por necesidad
Evalúa landings útiles para:
- Dónde...
- Qué hacer...
- Dónde comprar...
- Dónde comer...
- Dónde salir...
- Qué lugar...
- Algo barato...
- Cerca de...
- Abierto...
- Que acepte...

Solo crea páginas indexables si tienen valor real.

### 14. Performance
Es crítico por el contexto de conectividad en Cuba.

Audita JavaScript, imágenes, mapas, fuentes, requests, bundle, lazy loading, caching, SSR, rendering y Core Web Vitals.

Prioriza mobile-first, bajo consumo de datos, carga rápida y degradación elegante. El mapa no debe bloquear toda la experiencia.

### 15. Social Discovery
Optimiza Open Graph, Twitter/X cards, previews, URLs públicas, títulos, descripciones e imágenes sociales.

Prioriza contenido como:
“5 lugares en La Habana para una cita tranquila”
en vez de únicamente “Usa La Verde”.

### 16. Conversión
Analiza búsqueda, filtros, ficha del lugar, llamadas, WhatsApp, web, ubicación, compartir, guardar, registro e incorporación de negocios.

### 17. Analytics
Define eventos de adquisición, búsquedas, consultas a IA, vistas de lugares, filtros, clics, shares, llamadas, WhatsApp, webs externas, registros y conversiones.

### 18. Modelo de negocio
Dos lados:
- usuarios: descubrir y decidir;
- negocios: aparecer, recibir visitas cualificadas y obtener insights.

Respeta el principio:
**“No es publicidad pagada: lo bueno aparece porque lo merece.”**

### 19. ASO
Actualmente **NO es prioridad**, porque La Verde es web y no existe app nativa. Solo prepara arquitectura futura si aporta valor.

### 20. Seguridad
Audita autenticación, autorización, endpoints, exposición de datos, búsquedas, parámetros, formularios, secretos, variables de entorno, headers, dependencias y datos privados.

## PRIORIZACIÓN
**P0 crítico / P1 alto / P2 medio / P3 mejora**

Cada hallazgo: problema, impacto, evidencia, solución, dificultad y prioridad.

## IMPLEMENTACIÓN
Implementa lo posible desde código. Ejecuta build, lint, tests y validaciones de rutas, metadata, sitemap, robots, structured data, rendering y performance.

## ACCIONES MANUALES
Si necesitas Search Console, Analytics, dominio/DNS, redes, hosting, APIs u otras plataformas, no inventes acceso.

### ACCIONES MANUALES PENDIENTES
1. Plataforma.
2. Objetivo.
3. Paso a paso.
4. Valor exacto.
5. Dónde obtenerlo.
6. Cómo verificarlo.
7. Estado.

## RESTRICCIONES
Nunca inventes negocios, horarios, precios, monedas, métodos de pago, reseñas, estadísticas, indexación, backlinks, citas de IA o resultados. No generes thin content ni expongas secretos.

## INFORME FINAL
1. Resumen ejecutivo.
2. Discovery.
3. Search Intent.
4. Local SEO.
5. Arquitectura.
6. Programmatic SEO.
7. Páginas de lugares.
8. Indexación.
9. Rendering.
10. Structured Data.
11. AEO.
12. Entity SEO.
13. Internal Linking.
14. Discovery por necesidad.
15. Performance.
16. Social Discovery.
17. Conversión.
18. Analytics.
19. Modelo de negocio.
20. Seguridad.
21. Cambios realizados.
22. Archivos modificados.
23. Validaciones.
24. Pendientes.
25. Acciones manuales.
26. Roadmap P0/P1/P2/P3.

**Objetivo final:** NECESIDAD → DISCOVERY → SEO → AEO/IA → LA VERDE → EXPLORACIÓN → RECOMENDACIÓN → ACCIÓN → RETENCIÓN
