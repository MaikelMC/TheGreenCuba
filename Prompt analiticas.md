# Prompt analíticas   
  
# MISIÓN  
  
Quiero implementar en el proyecto actual de La Verde un sistema completo de analíticas internas y un panel de Analytics dentro del panel de administración.  
  
La Verde actualmente utiliza:  
  
- Vercel Free para la aplicación/web/API según la arquitectura existente.  
- Neon Free como base de datos PostgreSQL.  
- No quiero incorporar Supabase únicamente para analytics.  
- Quiero mantener inicialmente TODOS los datos de producto y analytics en Neon.  
- Quiero estirar los planes gratuitos tanto como sea razonablemente posible durante la etapa inicial de crecimiento.  
  
Por lo tanto:  
  
LA PRIORIDAD NO ES SOLAMENTE TENER MUCHAS MÉTRICAS.  
  
La prioridad es:  
  
DATOS REALES  
→ BAJO CONSUMO  
→ BUENAS CONSULTAS  
→ ESCALABILIDAD PROGRESIVA  
→ SEGURIDAD  
→ UTILIDAD PARA DECISIONES DE NEGOCIO  
  
NO quiero una arquitectura sobredimensionada.  
  
NO quiero añadir Supabase, Redis, ClickHouse, BigQuery, otro PostgreSQL, otro warehouse ni servicios adicionales únicamente para esta implementación.  
  
Si en el futuro el volumen realmente lo exige, la arquitectura deberá permitir migrar la capa de analytics, pero NO debemos anticipar esa complejidad ahora.  
  
--------------------------------------------------  
# 1. ANTES DE PROGRAMAR  
--------------------------------------------------  
  
Primero inspecciona completamente el proyecto.  
  
Identifica:  
  
- framework frontend  
- framework backend  
- estructura de API  
- ORM  
- base de datos  
- modelos existentes  
- autenticación  
- autorización  
- panel de administración  
- sistema de búsqueda  
- sistema de negocios  
- categorías  
- ubicaciones  
- sistema de recomendaciones  
- sistema actual de logging  
- cualquier analytics existente  
- configuración de Vercel  
- configuración de Neon  
- variables de entorno  
- migraciones  
  
NO asumas que la aplicación utiliza una tecnología concreta.  
  
Utiliza la arquitectura real existente.  
  
Antes de modificar código, entrega un resumen breve:  
  
1. Stack detectado.  
2. Arquitectura detectada.  
3. Base de datos utilizada.  
4. Modelos relevantes.  
5. Cómo funciona actualmente una búsqueda.  
6. Cómo funciona actualmente un negocio.  
7. Cómo funciona el panel admin.  
8. Qué sistema de tracking existe actualmente.  
9. Qué archivos/módulos modificarás.  
10. Arquitectura propuesta para analytics.  
  
Después de ese análisis, procede con la implementación.  
  
--------------------------------------------------  
# 2. RESTRICCIÓN FUNDAMENTAL: VERCEL FREE  
--------------------------------------------------  
  
La aplicación actualmente utiliza Vercel Free.  
  
El sistema de analytics NO debe convertirse en una fuente importante de consumo de:  
  
- invocaciones serverless  
- duración de funciones  
- CPU  
- memoria  
- transferencia de datos  
- cold starts  
- consultas innecesarias  
  
Principio:  
  
ANALYTICS NUNCA DEBE PERJUDICAR AL PRODUCTO.  
  
Si analytics falla:  
  
- La búsqueda debe seguir funcionando.  
- La ficha de negocio debe seguir funcionando.  
- El registro debe seguir funcionando.  
- La aplicación debe seguir funcionando.  
  
Un error de analytics nunca debe provocar un error de producto.  
  
--------------------------------------------------  
# 3. RESTRICCIÓN FUNDAMENTAL: NEON FREE  
--------------------------------------------------  
  
Neon Free es actualmente la única base de datos que debe utilizarse.  
  
NO crear otra base de datos únicamente para analytics.  
  
NO añadir Supabase para analytics.  
  
NO añadir otro PostgreSQL.  
  
NO añadir un data warehouse.  
  
NO añadir ClickHouse.  
  
NO añadir BigQuery.  
  
NO añadir Redis únicamente para analytics.  
  
La solución debe compartir la base de datos Neon existente.  
  
La arquitectura debe minimizar:  
  
- CU-hours  
- consultas pesadas  
- scans completos  
- joins innecesarios  
- escrituras innecesarias  
- índices excesivos  
- almacenamiento innecesario  
  
--------------------------------------------------  
# 4. PRINCIPIO DE ARQUITECTURA  
--------------------------------------------------  
  
La arquitectura debe ser:  
  
                 LA VERDE  
                    │  
          ┌─────────┴─────────┐  
          │                   │  
       PRODUCTO           ANALYTICS  
          │                   │  
          └─────────┬─────────┘  
                    │  
                   NEON  
  
No crear infraestructura paralela.  
  
La analítica debe vivir junto a los datos de producto.  
  
--------------------------------------------------  
# 5. SISTEMA DE EVENTOS  
--------------------------------------------------  
  
Implementar un sistema interno de eventos ligero.  
  
Crear una tabla de eventos únicamente si no existe una solución adecuada.  
  
Nombre sugerido:  
  
analytics_events  
  
Adaptar al naming convention del proyecto.  
  
Eventos mínimos:  
  
USUARIOS:  
  
- user_registered  
- user_login  
  
BÚSQUEDA:  
  
- search_performed  
- search_results_shown  
- search_no_results  
  
NEGOCIOS:  
  
- business_viewed  
- business_impression  
- business_contact_clicked  
- business_whatsapp_clicked  
- business_phone_clicked  
- business_map_clicked  
- business_website_clicked  
- business_social_clicked  
  
REGISTRO DE NEGOCIOS:  
  
- business_registration_started  
- business_registration_completed  
- business_approved  
- business_rejected  
  
Si existen otras funcionalidades relevantes:  
  
- favorites  
- reviews  
- etc.  
  
solo agregarlas si realmente existen.  
  
NO crear eventos innecesarios.  
  
--------------------------------------------------  
# 6. EVENTOS LIGEROS  
--------------------------------------------------  
  
Cada evento debe almacenar únicamente la información necesaria.  
  
Campos base:  
  
- id  
- event_type  
- timestamp  
- user_id nullable  
- session_id nullable  
- business_id nullable  
- search_query nullable  
- category_id nullable  
- province nullable  
- municipality nullable  
- result_count nullable  
- source nullable  
- medium nullable  
- campaign nullable  
- metadata únicamente cuando sea estrictamente necesario  
  
NO guardar:  
  
- contraseñas  
- tokens  
- información sensible  
- datos personales innecesarios  
- contenido privado innecesario  
  
Evitar JSON metadata gigante.  
  
Los eventos deben ser pequeños.  
  
--------------------------------------------------  
# 7. NO BLOQUEAR EL PRODUCTO  
--------------------------------------------------  
  
El registro de analytics debe ser tolerante a fallos.  
  
Ejemplo:  
  
Usuario realiza una búsqueda.  
  
El flujo principal debe ser:  
  
1. procesar búsqueda  
2. obtener resultados  
3. responder al usuario  
4. registrar analytics cuando sea posible  
  
NO:  
  
1. guardar analytics  
2. esperar analytics  
3. procesar búsqueda  
  
Si el registro de analytics falla:  
  
NO fallar la búsqueda.  
  
Registrar el error de forma ligera.  
  
--------------------------------------------------  
# 8. EVITAR EVENTOS EXCESIVOS  
--------------------------------------------------  
  
NO implementar tracking de:  
  
- cada movimiento del mouse  
- cada scroll  
- hover  
- cada cambio visual  
- cada interacción trivial  
- movimientos del mapa  
- eventos duplicados  
  
Solo medir eventos útiles para decisiones de producto.  
  
--------------------------------------------------  
# 9. ÍNDICES  
--------------------------------------------------  
  
Diseñar índices cuidadosamente.  
  
NO crear índices indiscriminadamente.  
  
Como mínimo evaluar índices sobre:  
  
- event_type  
- timestamp  
- user_id  
- business_id  
  
y combinaciones que realmente sean utilizadas por las consultas.  
  
Antes de crear índices adicionales:  
  
analiza las consultas reales del dashboard.  
  
Objetivo:  
  
reducir scans completos y consumo de Neon.  
  
--------------------------------------------------  
# 10. RETENCIÓN DE EVENTOS RAW  
--------------------------------------------------  
  
NO guardar eventos detallados indefinidamente.  
  
Implementar una política configurable.  
  
Valor inicial recomendado:  
  
90 días de eventos detallados.  
  
Ejemplo:  
  
analytics_events  
        │  
        ├── últimos 90 días  
        │      eventos detallados  
        │  
        └── histórico  
               métricas agregadas  
  
La duración debe poder modificarse mediante configuración.  
  
NO eliminar métricas agregadas históricas.  
  
--------------------------------------------------  
# 11. AGREGACIONES  
--------------------------------------------------  
  
Crear una tabla de agregaciones diarias si la arquitectura lo permite.  
  
Nombre sugerido:  
  
analytics_daily  
  
Adaptar al naming convention existente.  
  
Puede contener:  
  
- date  
- province  
- municipality  
- category_id  
- searches  
- successful_searches  
- no_result_searches  
- business_views  
- business_actions  
- new_users  
- active_users  
  
NO almacenar dimensiones innecesarias.  
  
La tabla de agregaciones debe permitir que el dashboard consulte pocos registros en lugar de analizar todos los eventos históricos.  
  
--------------------------------------------------  
# 12. ESTRATEGIA DE CÁLCULO  
--------------------------------------------------  
  
IMPORTANTE:  
  
NO calcular estadísticas pesadas cada vez que ocurre un evento.  
  
NO ejecutar:  
  
COUNT/GROUP BY/JOIN complejos sobre toda la tabla de eventos en cada request.  
  
Preferir:  
  
- agregaciones  
- índices  
- consultas limitadas  
- filtros temporales  
- cache cuando realmente sea útil  
- cálculo bajo demanda para datos pequeños  
- jobs periódicos solamente cuando sean necesarios  
  
No introducir un sistema de jobs complejo si todavía no es necesario.  
  
--------------------------------------------------  
# 13. AGREGACIONES PERIÓDICAS  
--------------------------------------------------  
  
Si se necesita recalcular analytics_daily:  
  
hacerlo mediante el mecanismo de ejecución existente en el proyecto.  
  
Antes de crear cron jobs adicionales, inspeccionar si Vercel ya dispone de una solución adecuada en el proyecto.  
  
NO crear múltiples cron jobs innecesarios.  
  
El proceso debe:  
  
- ser idempotente  
- procesar únicamente periodos necesarios  
- evitar recalcular todo el histórico  
- evitar duplicar datos  
  
--------------------------------------------------  
# 14. DASHBOARD PRINCIPAL  
--------------------------------------------------  
  
Crear:  
  
/admin/analytics  
  
o adaptar la ruta existente.  
  
Debe existir:  
  
Selector:  
  
- Hoy  
- 7 días  
- 30 días  
- 90 días  
- Este año  
- Personalizado  
  
Comparación opcional:  
  
Periodo actual  
vs  
periodo anterior  
  
--------------------------------------------------  
# 15. KPIs PRINCIPALES  
--------------------------------------------------  
  
Mostrar:  
  
USUARIOS:  
  
- usuarios totales  
- nuevos usuarios  
- DAU  
- WAU  
- MAU  
- usuarios recurrentes  
  
RETENCIÓN:  
  
- D1  
- D7  
- D30  
  
BÚSQUEDAS:  
  
- búsquedas  
- búsquedas con resultados  
- búsquedas sin resultados  
- tasa de éxito  
  
NEGOCIOS:  
  
- negocios registrados  
- aprobados  
- activos  
- pendientes  
  
DESCUBRIMIENTO:  
  
- negocios vistos  
- acciones  
- conversión búsqueda → negocio  
  
No realizar consultas innecesarias para cada tarjeta.  
  
Cuando varias métricas puedan calcularse con una sola consulta agregada, hacerlo.  
  
--------------------------------------------------  
# 16. USUARIOS  
--------------------------------------------------  
  
Crear sección:  
  
Usuarios  
  
Mostrar:  
  
- usuarios totales  
- nuevos usuarios  
- DAU  
- WAU  
- MAU  
- recurrentes  
  
Gráficos:  
  
- nuevos usuarios por día  
- usuarios activos por día  
- nuevos vs recurrentes  
  
Evitar cargar eventos individuales en el frontend.  
  
Enviar únicamente datos agregados necesarios para las gráficas.  
  
--------------------------------------------------  
# 17. RETENCIÓN  
--------------------------------------------------  
  
Crear:  
  
Retención  
  
Calcular:  
  
- D1  
- D7  
- D14  
- D30  
  
La definición debe estar documentada.  
  
Priorizar uso real:  
  
- búsqueda  
- visualización de negocio  
- interacción  
  
No considerar únicamente login como actividad principal.  
  
Implementar cohortes de forma eficiente.  
  
No recalcular todas las cohortes desde cero para cada visita al dashboard si puede evitarse.  
  
--------------------------------------------------  
# 18. BÚSQUEDAS  
--------------------------------------------------  
  
Crear:  
  
Búsquedas  
  
Mostrar:  
  
- total  
- únicas  
- por usuario  
- con resultados  
- sin resultados  
- tasa de éxito  
  
Gráficos:  
  
- búsquedas por día  
- búsquedas por hora cuando el volumen lo justifique  
- búsquedas por categoría  
- búsquedas por provincia  
- búsquedas por municipio  
  
Tabla:  
  
Consultas más frecuentes.  
  
Columnas:  
  
- consulta  
- búsquedas  
- usuarios  
- resultados promedio  
- tasa sin resultados  
  
Aplicar LIMIT y paginación.  
  
--------------------------------------------------  
# 19. BÚSQUEDAS SIN RESULTADOS  
--------------------------------------------------  
  
Crear sección prioritaria:  
  
"Demandas sin oferta"  
  
Mostrar:  
  
- consulta  
- frecuencia  
- usuarios afectados  
- provincia  
- municipio  
- categoría  
  
Ordenar por oportunidad.  
  
Esto debe ayudar a decidir:  
  
"¿Qué negocio debería captar?"  
  
--------------------------------------------------  
# 20. DEMANDA VS OFERTA  
--------------------------------------------------  
  
Crear:  
  
"Demanda vs Oferta"  
  
Para:  
  
- categoría  
- provincia  
- municipio  
  
Calcular:  
  
demanda = búsquedas relevantes  
  
oferta = negocios activos  
  
Crear un score configurable.  
  
NO utilizar una fórmula arbitraria sin documentarla.  
  
Mostrar:  
  
- demanda  
- oferta  
- ratio  
- score  
- nivel de oportunidad  
  
Ejemplo:  
  
Electricistas  
  
127 búsquedas  
3 negocios  
42.3 búsquedas/negocio  
ALTA OPORTUNIDAD  
  
--------------------------------------------------  
# 21. NEGOCIOS  
--------------------------------------------------  
  
Mostrar:  
  
- total  
- aprobados  
- pendientes  
- rechazados  
- activos  
- inactivos  
  
Gráficos:  
  
- evolución  
- por categoría  
- por provincia  
- por municipio  
  
--------------------------------------------------  
# 22. CALIDAD DE FICHAS  
--------------------------------------------------  
  
Crear score de completitud 0-100%.  
  
Evaluar:  
  
- nombre  
- categoría  
- descripción  
- ubicación  
- provincia  
- municipio  
- coordenadas  
- teléfono  
- WhatsApp  
- horarios  
- fotos  
- servicios  
- productos  
- precios  
- moneda  
- métodos de pago  
- redes  
- web  
  
No todas las propiedades tienen que ser obligatorias.  
  
Definir pesos según el modelo actual de negocio.  
  
Mostrar:  
  
- promedio  
- completos  
- incompletos  
- críticos  
  
--------------------------------------------------  
# 23. ANALÍTICA INDIVIDUAL DE NEGOCIO  
--------------------------------------------------  
  
Cada negocio debe poder mostrar:  
  
- vistas  
- impresiones  
- búsquedas que lo encontraron  
- contactos  
- WhatsApp  
- teléfono  
- mapa  
- web  
- redes  
- favoritos si existe  
  
Utilizar consultas eficientes y periodos limitados.  
  
No cargar todos los eventos históricos de un negocio si solamente se necesitan agregados.  
  
--------------------------------------------------  
# 24. FUNNEL DE USUARIOS  
--------------------------------------------------  
  
Mostrar:  
  
Visita  
↓  
Registro  
↓  
Primera búsqueda  
↓  
Resultados  
↓  
Negocio visto  
↓  
Acción  
  
Calcular conversiones.  
  
No mostrar etapas sin datos suficientes.  
  
--------------------------------------------------  
# 25. FUNNEL DE NEGOCIOS  
--------------------------------------------------  
  
Mostrar:  
  
Registro iniciado  
↓  
Registro completado  
↓  
Aprobación  
↓  
Activo  
↓  
Primera aparición  
↓  
Primera vista  
↓  
Primera acción  
  
--------------------------------------------------  
# 26. GEOANALÍTICA  
--------------------------------------------------  
  
Crear:  
  
Geografía  
  
Mostrar:  
  
- usuarios por provincia  
- usuarios por municipio  
- búsquedas por provincia  
- búsquedas por municipio  
- negocios por provincia  
- negocios por municipio  
- demanda/oferta  
  
La Verde es para toda Cuba.  
  
NO asumir que La Habana es el centro de la plataforma.  
  
--------------------------------------------------  
# 27. CATEGORÍAS  
--------------------------------------------------  
  
Para cada categoría:  
  
- búsquedas  
- usuarios  
- negocios  
- vistas  
- acciones  
- búsquedas sin resultados  
- demanda/oferta  
  
Ordenar por:  
  
- demanda  
- crecimiento  
- oportunidad  
  
--------------------------------------------------  
# 28. UTM Y FUENTES  
--------------------------------------------------  
  
Preparar tracking:  
  
utm_source  
utm_medium  
utm_campaign  
utm_content  
utm_term  
  
Guardar:  
  
- source  
- medium  
- campaign  
- referrer  
  
No guardar datos innecesarios.  
  
Ejemplos:  
  
Instagram  
Facebook  
Google  
Direct  
Referral  
  
--------------------------------------------------  
# 29. GOOGLE ANALYTICS 4  
--------------------------------------------------  
  
Preparar módulo:  
  
"Adquisición"  
  
NO mostrar datos inventados.  
  
Si no está conectado:  
  
"Google Analytics no conectado"  
  
No es necesario implementar completamente la integración en esta fase si requiere credenciales externas.  
  
Dejar una arquitectura preparada para conectar posteriormente GA4 mediante API oficial.  
  
Cuando esté conectado podrá mostrar:  
  
- usuarios  
- sesiones  
- fuentes  
- medios  
- campañas  
- landing pages  
- dispositivos  
- engagement  
  
Las métricas internas de producto siguen teniendo como fuente principal analytics_events.  
  
--------------------------------------------------  
# 30. GOOGLE SEARCH CONSOLE  
--------------------------------------------------  
  
Crear módulo:  
  
"SEO"  
  
Si no existe conexión:  
  
"Google Search Console no conectado"  
  
No inventar números.  
  
Preparar futura integración para:  
  
- impresiones  
- clicks  
- CTR  
- posición  
- consultas  
- páginas  
- dispositivos  
- países  
  
También mostrar métricas SEO internas disponibles sin API externa.  
  
--------------------------------------------------  
# 31. META  
--------------------------------------------------  
  
Crear módulo:  
  
"Redes sociales"  
  
Si no está conectado:  
  
"Meta no conectado"  
  
NO hacer scraping.  
  
Preparar futura integración oficial mediante Meta API.  
  
No es prioridad para esta fase.  
  
--------------------------------------------------  
# 32. FILTROS  
--------------------------------------------------  
  
Los filtros deben incluir:  
  
- periodo  
- provincia  
- municipio  
- categoría  
- negocio  
  
Cuando corresponda:  
  
- source  
- medium  
- campaign  
  
Los filtros deben ejecutarse principalmente en backend.  
  
No enviar todos los datos al frontend para filtrar allí.  
  
--------------------------------------------------  
# 33. CACHE  
--------------------------------------------------  
  
Utilizar cache solamente cuando proporcione beneficio real.  
  
Priorizar cache para:  
  
- dashboard general  
- métricas de periodos históricos  
- agregaciones  
  
No añadir Redis únicamente para este propósito.  
  
Si el proyecto ya tiene mecanismos de cache, reutilizarlos.  
  
--------------------------------------------------  
# 34. PAGINACIÓN  
--------------------------------------------------  
  
Toda tabla potencialmente grande debe tener:  
  
- paginación  
- LIMIT  
- filtros  
- ordenamiento controlado  
  
Nunca devolver todos los eventos al frontend.  
  
--------------------------------------------------  
# 35. CSV  
--------------------------------------------------  
  
IMPLEMENTAR EXPORTACIÓN CSV.  
  
Debe funcionar para:  
  
- usuarios  
- búsquedas  
- búsquedas sin resultados  
- consultas frecuentes  
- negocios  
- vistas de negocios  
- acciones  
- demanda/oferta  
- categorías  
- provincias  
- municipios  
- retención  
- funnel  
- eventos  
  
Los CSV deben:  
  
- UTF-8  
- encabezados claros  
- respetar filtros  
- respetar periodo  
- respetar ordenamiento  
- tener nombres descriptivos  
  
Ejemplo:  
  
laverde_busquedas_2026-10-01_2026-10-04.csv  
  
--------------------------------------------------  
# 36. CSV Y CONSUMO DE VERCEL  
--------------------------------------------------  
  
IMPORTANTE:  
  
No generar CSV gigantes cargando todos los registros simultáneamente en memoria.  
  
Para exportaciones normales:  
  
- utilizar paginación/streaming cuando sea apropiado.  
  
Para exportaciones grandes:  
  
- evaluar generación por lotes.  
  
NO implementar una arquitectura de procesamiento asíncrono compleja todavía.  
  
Si el volumen actual es pequeño, mantener una solución sencilla.  
  
La arquitectura debe poder evolucionar posteriormente.  
  
--------------------------------------------------  
# 37. EXPORTACIÓN DE EVENTOS CRUDOS  
--------------------------------------------------  
  
Permitir:  
  
"Exportar eventos"  
  
Campos:  
  
- event_id  
- event_type  
- timestamp  
- user_id  
- session_id  
- business_id  
- search_query  
- category  
- province  
- municipality  
- result_count  
- source  
- medium  
- campaign  
  
Respetar privacidad.  
  
Aplicar filtros y paginación.  
  
--------------------------------------------------  
# 38. HISTORIAL DE EXPORTACIONES  
--------------------------------------------------  
  
Si es sencillo y compatible con la arquitectura actual:  
  
guardar:  
  
- usuario administrador  
- fecha  
- tipo  
- periodo  
- filtros  
- cantidad de registros  
  
No guardar archivos permanentemente sin necesidad.  
  
--------------------------------------------------  
# 39. SEGURIDAD  
--------------------------------------------------  
  
Analytics debe estar protegido.  
  
Solo administradores autorizados.  
  
Proteger:  
  
- páginas  
- endpoints  
- exportaciones  
- datos de usuarios  
- datos de negocios  
  
Nunca confiar solamente en el frontend.  
  
--------------------------------------------------  
# 40. PRIVACIDAD  
--------------------------------------------------  
  
No registrar información sensible.  
  
No guardar contenido innecesario.  
  
Si se puede medir una métrica mediante:  
  
user_id + evento  
  
no guardar información personal adicional.  
  
--------------------------------------------------  
# 41. MONITOREO DEL CONSUMO  
--------------------------------------------------  
  
Crear dentro del admin una sección:  
  
"Salud de Analytics"  
  
Mostrar, si es posible con datos internos:  
  
- cantidad de eventos  
- eventos últimos 24h  
- eventos últimos 7 días  
- eventos últimos 30 días  
- tamaño estimado de analytics  
- crecimiento estimado  
- fecha de último agregado  
- estado del procesamiento  
  
Ejemplo:  
  
Analytics  
  
Eventos últimos 30 días:  
48.231  
  
Crecimiento:  
+8.4 MB  
  
Última agregación:  
Hoy 03:00  
  
Estado:  
🟢 Normal  
  
IMPORTANTE:  
  
NO inventar métricas sobre consumo real de Neon si Neon no proporciona ese dato a través de una API disponible.  
  
Distinguir claramente:  
  
"estimado"  
  
de  
  
"real".  
  
No hacer consultas frecuentes a Neon únicamente para obtener métricas de consumo.  
  
--------------------------------------------------  
# 42. LIMPIEZA DE EVENTOS  
--------------------------------------------------  
  
Implementar limpieza de eventos antiguos únicamente si es segura.  
  
Valor inicial:  
  
90 días.  
  
La limpieza debe:  
  
- ser idempotente  
- ejecutarse por lotes  
- no bloquear la base de datos  
- no eliminar agregaciones  
- poder pausarse/desactivarse  
  
NO ejecutar DELETE masivo de millones de filas en una sola operación.  
  
Si algún día el volumen es grande, procesar por lotes.  
  
--------------------------------------------------  
# 43. EVITAR ESCRITURAS EXCESIVAS  
--------------------------------------------------  
  
No registrar dos veces el mismo evento por una sola acción.  
  
Cuando sea posible utilizar:  
  
- event_id único  
- idempotency key  
- deduplicación  
  
No crear eventos artificiales simplemente para aumentar cobertura de analytics.  
  
--------------------------------------------------  
# 44. EVITAR LECTURAS EXCESIVAS  
--------------------------------------------------  
  
El dashboard debe intentar:  
  
- agrupar métricas  
- reducir consultas  
- reutilizar resultados  
- consultar únicamente el periodo solicitado  
- utilizar agregaciones  
  
Ejemplo:  
  
NO hacer 10 queries independientes para 10 tarjetas si pueden resolverse mediante una consulta agregada razonable.  
  
Pero tampoco crear una consulta monstruosa imposible de mantener.  
  
Buscar equilibrio entre rendimiento y mantenibilidad.  
  
--------------------------------------------------  
# 45. ARQUITECTURA PREPARADA PARA CRECER  
--------------------------------------------------  
  
La solución actual debe ser:  
  
SIMPLE AHORA  
→ EFICIENTE  
→ MIGRABLE DESPUÉS  
  
No diseñar todavía para millones de usuarios.  
  
Pero documentar el punto de migración.  
  
Ejemplo:  
  
Actual:  
  
Neon  
+  
analytics_events  
+  
analytics_daily  
  
Futuro si el volumen lo requiere:  
  
Neon → datos de producto  
Analytics warehouse → eventos masivos  
  
NO implementar la arquitectura futura ahora.  
  
--------------------------------------------------  
# 46. DASHBOARD UX  
--------------------------------------------------  
  
Diseño:  
  
- profesional  
- limpio  
- rápido  
- responsive  
- coherente con La Verde  
- verde/blanco  
- información accionable  
  
No llenar la pantalla de gráficos innecesarios.  
  
La pantalla Resumen debe responder:  
  
"¿Cómo está La Verde?"  
  
y:  
  
"¿Qué debería hacer ahora?"  
  
Crear bloque:  
  
🔥 OPORTUNIDADES  
  
Ejemplos:  
  
Alta demanda / baja oferta  
  
Búsquedas sin resultados  
  
Categorías creciendo  
  
Zonas con demanda  
  
Negocios con fichas incompletas  
  
--------------------------------------------------  
# 47. NAVEGACIÓN  
--------------------------------------------------  
  
Propuesta:  
  
Analytics  
  
├── Resumen  
├── Usuarios  
├── Retención  
├── Búsquedas  
├── Demanda vs Oferta  
├── Negocios  
├── Categorías  
├── Geografía  
├── Funnel  
├── SEO  
├── Adquisición  
├── Redes Sociales  
└── Exportaciones  
  
Adaptar a la navegación actual.  
  
--------------------------------------------------  
# 48. TESTS  
--------------------------------------------------  
  
Crear tests para:  
  
- eventos  
- deduplicación  
- DAU  
- WAU  
- MAU  
- retención  
- búsquedas exitosas  
- búsquedas sin resultados  
- demanda/oferta  
- conversión  
- negocios  
- calidad de fichas  
- filtros  
- CSV  
- permisos  
  
Los tests no deben insertar datos falsos en producción.  
  
--------------------------------------------------  
# 49. DOCUMENTACIÓN  
--------------------------------------------------  
  
Crear documentación explicando:  
  
- arquitectura  
- eventos  
- tablas  
- índices  
- retención de eventos  
- agregaciones  
- definición de KPIs  
- cálculo de retención  
- cálculo demanda/oferta  
- filtros  
- exportaciones  
- limpieza  
- integración GA4  
- integración Search Console  
- integración Meta  
- estrategia de escalabilidad  
  
--------------------------------------------------  
# 50. CRITERIOS DE ACEPTACIÓN  
--------------------------------------------------  
  
La implementación se considera correcta cuando:  
  
[ ] Analytics utiliza Neon existente.  
[ ] NO se añadió Supabase.  
[ ] NO se añadió otro sistema de base de datos.  
[ ] Eventos reales se registran.  
[ ] Analytics no bloquea funcionalidades.  
[ ] No existen datos fake en producción.  
[ ] Los eventos son pequeños.  
[ ] Existen índices apropiados.  
[ ] Existen agregaciones.  
[ ] El dashboard no consulta todo el histórico en cada carga.  
[ ] Las tablas tienen paginación.  
[ ] Las consultas tienen filtros.  
[ ] Existe política de retención de eventos.  
[ ] Existe limpieza por lotes.  
[ ] Existe control de duplicación.  
[ ] Existe dashboard de usuarios.  
[ ] Existe retención.  
[ ] Existe búsqueda.  
[ ] Existe búsquedas sin resultados.  
[ ] Existe demanda vs oferta.  
[ ] Existe analytics de negocios.  
[ ] Existe calidad de fichas.  
[ ] Existe geografía.  
[ ] Existe categorías.  
[ ] Existe funnel.  
[ ] Existe tracking UTM.  
[ ] Existe preparación GA4.  
[ ] Existe preparación Search Console.  
[ ] Existe preparación Meta.  
[ ] Existe exportación CSV.  
[ ] CSV respeta filtros.  
[ ] CSV no carga datasets gigantes en memoria.  
[ ] Analytics está protegido.  
[ ] Existen tests.  
[ ] Existe documentación.  
[ ] No se añadieron servicios innecesarios.  
  
--------------------------------------------------  
# 51. ORDEN DE IMPLEMENTACIÓN  
--------------------------------------------------  
  
Implementar en este orden:  
  
FASE 0  
Auditoría del proyecto.  
  
FASE 1  
Modelo de eventos + migración + índices.  
  
FASE 2  
Tracking de eventos principales.  
  
FASE 3  
Agregaciones diarias.  
  
FASE 4  
Backend Analytics.  
  
FASE 5  
Dashboard Resumen.  
  
FASE 6  
Búsquedas + búsquedas sin resultados.  
  
FASE 7  
Demanda vs Oferta.  
  
FASE 8  
Usuarios + Retención.  
  
FASE 9  
Negocios + calidad.  
  
FASE 10  
Geografía + categorías.  
  
FASE 11  
Funnels.  
  
FASE 12  
CSV.  
  
FASE 13  
Salud de Analytics.  
  
FASE 14  
Preparación GA4.  
  
FASE 15  
Preparación Search Console.  
  
FASE 16  
Preparación Meta.  
  
NO avanzar innecesariamente hacia una arquitectura compleja.  
  
--------------------------------------------------  
# 52. PROTOCOLO DE EJECUCIÓN  
--------------------------------------------------  
  
Trabaja incrementalmente.  
  
Después de cada fase:  
  
1. ejecutar tests  
2. verificar migraciones  
3. verificar consultas  
4. verificar endpoints  
5. verificar frontend  
6. revisar errores  
7. comprobar que no aumenta innecesariamente el consumo  
8. continuar  
  
Antes de crear una dependencia nueva:  
  
pregúntate:  
  
"¿Realmente es necesaria?"  
  
Si no lo es:  
  
NO instalarla.  
  
--------------------------------------------------  
# 53. AUDITORÍA FINAL DE CONSUMO  
--------------------------------------------------  
  
Al finalizar realiza una revisión específica:  
  
VERCEL:  
  
- número de nuevas funciones serverless  
- endpoints nuevos  
- frecuencia de llamadas  
- operaciones innecesarias  
- tamaño de respuestas  
- posibilidad de caching  
- posibles funciones pesadas  
  
NEON:  
  
- nuevas tablas  
- nuevos índices  
- consultas principales  
- posibles full table scans  
- operaciones GROUP BY pesadas  
- JOINs pesados  
- escrituras por evento  
- estrategia de limpieza  
- crecimiento estimado de analytics  
  
Identifica cualquier punto que pueda convertirse en cuello de botella.  
  
No afirmes que conoces el consumo real de Vercel o Neon si no tienes acceso a esas métricas.  
  
Diferencia:  
  
- consumo medido  
- consumo estimado  
- riesgo potencial  
  
--------------------------------------------------  
# 54. RESULTADO FINAL  
--------------------------------------------------  
  
Al finalizar entrega:  
  
1. Resumen de arquitectura encontrada.  
2. Arquitectura implementada.  
3. Archivos creados.  
4. Archivos modificados.  
5. Migraciones.  
6. Tablas nuevas.  
7. Índices.  
8. Eventos.  
9. Agregaciones.  
10. Endpoints.  
11. Pantallas.  
12. Tests.  
13. Exportaciones CSV.  
14. Política de retención.  
15. Estrategia de limpieza.  
16. Cómo comprobar que los eventos están funcionando.  
17. Qué consume Vercel.  
18. Qué consume Neon.  
19. Qué partes son estimaciones.  
20. Qué optimizaciones fueron implementadas.  
21. Qué queda preparado para GA4.  
22. Qué queda preparado para Search Console.  
23. Qué queda preparado para Meta.  
24. Qué NO se implementó y por qué.  
25. Qué debería hacerse cuando aumente significativamente el tráfico.  
  
--------------------------------------------------  
# REGLA FINAL  
--------------------------------------------------  
  
NO optimices prematuramente hacia una infraestructura empresarial.  
  
La Verde está en etapa inicial.  
  
Quiero una arquitectura:  
  
SIMPLE  
+  
BARATA  
+  
REAL  
+  
MEDIBLE  
+  
SEGURA  
+  
ESCALABLE PROGRESIVAMENTE  
  
Utiliza Vercel Free y Neon Free de forma extremadamente eficiente.  
  
El objetivo es que el sistema pueda acompañar a La Verde durante su etapa inicial de adquisición de usuarios y negocios sin obligarme a contratar servicios adicionales antes de que realmente sean necesarios.  
