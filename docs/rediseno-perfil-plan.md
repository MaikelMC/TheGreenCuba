# Rediseño del perfil y la navegación — análisis y plan

> Solo análisis. No se modificó código de la aplicación.
> Fecha: 27 de noviembre de 2026.
> Base: auditorías aportadas + verificación directa de los archivos citados.

## 1. Veredicto

El rediseño **no necesita una reconstrucción**. El perfil ya existe, ya está protegido y ya tiene tres secciones con dock propio; lo que falla es la **navegación entre secciones**, la **separación entre preferencias y actividad**, el **etiquetado de algunas entradas del menú** y un puñado de **funciones que la UI insinúa pero no existen** (favoritos en servidor, cambio de correo real, validación).

La mayor parte del trabajo es de integración, no de diseño visual: conservar `DetailsView`, `PlacesView`, `SettingsView`, `ProfileDock`, `MobileDock`, `UserMenu` y los tokens de `DESIGN.md`, y corregir la estructura que los conecta.

Lo que **no** se debe hacer en este rediseño:

- Reescribir el perfil como una página nueva con otro sistema visual.
- Crear rutas `/favoritos`, `/cuenta` o `/preferencias` que dupliquen lo que ya vive en `/profile?seccion=…`.
- Convertir el correo editable en un cambio de credencial sin tocar Better Auth.
- Simular un historial de pedidos del cliente: los pedidos que existen son los que recibe el negocio.

## 2. Lo que se confirma en el código

| Afirmación de la auditoría | Estado | Evidencia |
|---|---|---|
| `/profile` es una sola página cliente sin subrutas ni `layout.tsx` | Confirmado | `src/app/(main)/profile/page.tsx:47` |
| Las secciones se cambian con `replaceState`, sin `pushState` ni `popstate` | Confirmado | `profile/page.tsx:87-98` |
| `?seccion=negocio&modo=proyecto` abre el alta de proyecto; sin `modo`, el alta de negocio | Confirmado | `profile/page.tsx:74-80` |
| «Registrar proyecto» pierde el `modo` al cambiar de vista | Confirmado | `profile/page.tsx:100-103` |
| El dock solo tiene Info, Sobre mí y Configuración | Confirmado | `profile-dock.tsx:21-25` |
| Guardar aparece en Info y en Sobre mí y envía el perfil completo | Confirmado | `profile/page.tsx:296-314`, `:227-251` |
| Nombre, correo y teléfono se aceptan solo con `trim()` | Confirmado | `src/app/api/me/route.ts:289-301` |
| La provincia se guarda sin validar contra las 16 provincias | Confirmado | `api/me/route.ts:293-299`, `:335-337` |
| Los inputs de correo y teléfono no declaran `type` | Confirmado | `details-view.tsx:339-343` |
| `saved_places` solo se lee; no hay POST/DELETE en el repo | Confirmado | `src/app/api/me/places/route.ts:7-35` |
| El corazón del home guarda solo en localStorage | Confirmado | `src/lib/activity-store.ts` (`toggleSaved`), `home/page.tsx:1174-1185` |
| `/tarjetas` no está en `PROTECTED_PREFIXES` | Confirmado | `src/lib/session.ts:33-47` |
| `SettingsView` pide `/api/me` por su cuenta y no tiene reintento | Confirmado | `settings-view.tsx:79-92` |
| «Mis pedidos» apunta a `/business?seccion=pedidos` | Confirmado | `user-menu.tsx:511-520` |
| Las tarjetas viven solo en localStorage, sin `user_id` en la tabla | Confirmado | `tarjeta-cliente.tsx:85`, esquema de fidelidad |

### Matices que conviene corregir de la auditoría

1. **«Mis pedidos» no se le muestra a cualquier usuario.** El contador solo se pide si `user.business?.isActive && user.business.id`; sin negocio activo, `pendientesPedidos` queda en `null` y la entrada no se pinta (`user-menu.tsx:361-380`, `:511`). El problema real no es un enlace fantasma para todos, sino que **un dueño ve los pedidos que recibe su negocio bajo el nombre «Mis pedidos»**, que suena a historial de compras. La corrección es de etiqueta y de ubicación en el menú, no de ruta.
2. **`/tarjetas` pública no expone datos ajenos.** La página solo lee tokens del `localStorage` de ese dispositivo y consulta `/api/tarjeta/[token]`, que es público por diseño. El riesgo no es fuga entre usuarios, sino que los tokens sobrevivan al cierre de sesión en un equipo compartido.
3. **Las preferencias no se vacían en guardados parciales.** `POST /api/me` solo escribe `preferences` si el cuerpo trae `interests`, `moods` o `currencies`, y solo escribe ubicación si trae `location`/`locationName` (`api/me/route.ts:335-351`). Eso ya está resuelto y hay que conservarlo.
4. **El `negocio` del dock no es una pestaña.** Es una vista oculta que solo se alcanza desde las tarjetas de Info; por eso el dock no la lista. Cualquier rediseño debe mantener ese acceso, aunque se renombre.
5. **`users.image_url` existe pero no se usa.** No hay que pintar un avatar editable; el menú usa la inicial a propósito (`user-menu.tsx:476`).

## 3. Decisiones que requieren tu aprobación

Antes de tocar estas, conviene elegir. Todas cambian comportamiento, no solo estética.

### 3.1 Favoritos: ¿conectar `saved_places` o dejar localStorage?

La tabla existe y se lee, pero nada la escribe. Conectarla implica:

- Endpoint `POST/DELETE /api/me/places` (la tabla ya existe: **sin migración**).
- Que el corazón del home deje de mirar solo `localStorage` y consulte/actualice el servidor.
- Decidir qué pasa con los favoritos que hoy solo están en el navegador: se pueden migrar al iniciar sesión (una vez) o dejarlos como copia local.
- Resolver el caso invitado: hoy puede guardar en `localStorage`; al entrar, ¿se suben?

**Recomendación:** hacerlo, pero en una fase aparte y con migración explícita de la copia local. Es la única forma de que el perfil y el home no muestren listas distintas.

### 3.2 Correo editable: ¿dejarlo de solo lectura o sincronizarlo?

Hoy se edita `users.email`, pero el login usa `neon_auth`. El usuario puede creer que cambió su correo de acceso y no es así.

**Recomendación:** dejarlo de solo lectura en el perfil, con una línea que explique que el correo de acceso se gestiona desde la cuenta, y un enlace a soporte. Sincronizarlo con Better Auth exige verificación y un flujo nuevo: fuera del alcance seguro de este rediseño.

### 3.3 Historial de secciones: `replaceState` o `pushState`

Hoy `replaceState` evita tres pasos de historial, pero el botón «atrás» sale del perfil. El rediseño pide navegación tipo pestañas con atrás/adelante.

**Recomendación:** `pushState` + `popstate`, manteniendo el estado del formulario en el mismo componente. Es un cambio pequeño y reversible. Si prefieres no ensuciar el historial, se deja `replaceState` y se documenta que «atrás» sale del perfil.

### 3.4 Tokens de tarjetas al cerrar sesión

Hoy sobreviven al logout y al borrado de cuenta. Purgarlos protege un equipo compartido, pero **si el usuario vuelve a entrar en el mismo navegador pierde el acceso a sus tarjetas**, porque el token es la única credencial y no está vinculado a la cuenta.

**Recomendación:** no purgarlos automáticamente. Si se quiere cerrar ese hueco, hacerlo solo en el borrado de cuenta (acción explícita) y avisarlo en el diálogo, no en cada logout.

### 3.5 Validación de datos personales

Añadir formato de correo, longitud de nombre/teléfono y lista blanca de provincia es sano, pero `POST /api/me` lo comparten el onboarding, la ventana del teléfono, los términos y el consentimiento de marketing. Una validación estricta mal puesta rompe esos flujos parciales.

**Recomendación:** validar solo los campos presentes y no romper los cuerpos parciales; provincia contra `CUBA_PROVINCES`; correo con formato y sin unicidad (la unicidad es de `neon_auth`). Hacerlo en una fase propia con pruebas de los cuatro flujos.

## 4. Correspondencia entre el rediseño y lo que ya existe

| Elemento del rediseño | Implementación actual | Archivo / componente | Ruta / API | Acción |
|---|---|---|---|---|
| **Mi perfil** | «Info»: datos personales, provincia, accesos a negocio/proyecto, Kynari | `details-view.tsx` | `/profile?seccion=perfil` · `GET/POST /api/me` | Reutilizar; renombrar «Info» → «Mi perfil»; correo de solo lectura |
| **Preferencias** | Hoy dentro de «Sobre mí», plegadas en acordeón | `PreferenceSections` en `details-view.tsx`; estado en `profile/page.tsx` | `POST /api/me` (`interests`, `moods`, `currencies`, `location`) | Extraer a sección propia; conservar contrato y guardado |
| **Cuenta** | «Configuración»: cuenta, tema, legal, soporte, borrado | `settings-view.tsx` | `GET/DELETE /api/me`, `POST /api/support` | Reutilizar; añadir estado de error/reintento; no mover el borrado |
| **Actividad / favoritos** | «Sobre mí»: estadísticas, gráfico, guardados | `places-view.tsx` | `GET /api/me/places`, `activity-store` | Separar de preferencias; decidir §3.1 |
| **Dock de secciones** | Tres entradas, dock de escritorio con magnificación y `MobileDock` | `profile-dock.tsx`, `mobile-dock.tsx` | — | Reutilizar; añadir la cuarta sección si se separa Preferencias |
| **Menú del avatar** | «Lo mío» + «Paneles» + «Preferencias» | `user-menu.tsx:480-590`, `:820-880` | `/api/me` | Reordenar y renombrar; no duplicar accesos |
| **Mis favoritos** | `/profile?seccion=lugares` | `user-menu.tsx:497-503` | `GET /api/me/places` | Conservar ruta; decidir escritura §3.1 |
| **Mis tarjetas** | `/tarjetas` pública, tokens locales | `app/(main)/tarjetas/page.tsx` | `GET /api/tarjeta/[token]` | Preservar; decidir protección §3.4 |
| **Pedidos** | Pedidos **recibidos** por el negocio | `business` sección `pedidos` | `/business?seccion=pedidos` | Renombrar «Pedidos de mi negocio» y moverlo a «Paneles» |
| **Notificaciones** | Bandeja completa + campana del home | `notifications-view.tsx`, `map-notifications.tsx` | `GET/PATCH /api/notifications` | Preservar fuente única; no añadir entrada duplicada |
| **Panel de negocio** | Solo con negocio activo | `business/page.tsx`, layout | `/business` | Preservar permisos |
| **Proyectos** | `/projects`, alta desde perfil | `project-management-panel.tsx`, `projects-view.tsx` | `GET/POST /api/project-requests` | Preservar; corregir deep link |
| **Afiliado** | Solo con `referralCode` | `enlaces/page.tsx` | — | Preservar visibilidad condicionada |
| **Administración** | Rol admin en layout | `admin/layout.tsx` | `/admin/**` | Preservar |
| **Términos y privacidad** | `/terminos`, ancla `#privacidad` | `terminos/page.tsx` | — | Preservar; no crear `/privacidad` sin decidirlo |
| **Onboarding** | Flujo completo con pasos | `app/onboarding/page.tsx` | `POST /api/me` | Fuera del rediseño salvo los arreglos seguros de §6 |

## 5. Plan propuesto por fases

### Fase A — Navegación y estructura (bajo riesgo, sin datos)

1. **Corregir el deep link de proyecto.** `openProjectFlow("registration")` debe escribir `seccion=negocio&modo=proyecto`; `changeView` acepta un `modo` opcional. Archivo: `profile/page.tsx:87-103`.
2. **Sincronizar la sección con la URL al navegar.** Leer `?seccion=` al montar **y** al cambiar `popstate`; decidir §3.3. Archivo: `profile/page.tsx:59-98`.
3. **Separar Preferencias de Actividad.** Nueva sección en `DOCK_ITEMS` (`preferencias`), mover `PreferenceSections` allí, dejar en «Sobre mí» solo actividad y guardados. Archivos: `profile-dock.tsx`, `profile/page.tsx`, `places-view.tsx`, `details-view.tsx`.
   - Mantener compatibilidad: `?seccion=lugares` sigue abriendo actividad; `?seccion=perfil` sigue existiendo.
4. **Renombrar el dock:** «Info» → «Mi perfil», «Sobre mí» → «Actividad», «Configuración» → «Cuenta». Solo etiquetas; los `id` internos no cambian.
5. **Arreglar el menú del avatar.** Mover «Pedidos» de «Lo mío» a «Paneles» y renombrarlo «Pedidos de mi negocio»; separador visual entre actividad personal y herramientas. Archivo: `user-menu.tsx:480-590`.

**Riesgo:** bajo. No toca API ni base de datos. Único punto delicado: el estado del formulario al cambiar de sección debe seguir viviendo en `profile/page.tsx`.

### Fase B — Cuenta y datos (riesgo medio, sin migración)

1. **Correo de solo lectura** en `details-view.tsx` con explicación y enlace a soporte; dejar de enviarlo en el POST del perfil o enviarlo sin cambios. Decidir §3.2.
2. **Validación mínima en `POST /api/me`**: provincia contra `CUBA_PROVINCES`; nombre con longitud; correo con formato solo si se decide mantenerlo editable. No tocar los cuerpos parciales. Archivo: `api/me/route.ts`.
3. **Estados de error en Cuenta**: si `fetchMe` falla, mostrar reintento en vez de «Sin sesión». Archivo: `settings-view.tsx:79-92`.
4. **Evitar la triple llamada a `/api/me`** en la misma pantalla: `PlacesView` puede recibir `userId` desde el armazón en lugar de pedirlo otra vez (`places-view.tsx:62-73`). `fetchMe` ya cachea, pero el `refreshSession()` posterior obliga a repoblar.
5. **Provincia y municipio:** no hay municipio en el modelo. No añadir el control hasta decidir si se agrega una columna; documentarlo como cambio de esquema, no hacerlo en esta fase.

**Riesgo:** medio por los flujos parciales que comparten `POST /api/me` (onboarding, teléfono de Google, términos, marketing). Cada cambio necesita probar los cuatro.

### Fase C — Favoritos reales (riesgo medio-alto, requiere decisión)

Solo si se aprueba §3.1:

1. `POST /api/me/places` y `DELETE /api/me/places` con validación de `placeId` y `onConflictDoNothing`.
2. Migración única de `activity-store.savedIds` a `saved_places` al iniciar sesión, sin duplicar y sin borrar la copia local hasta confirmar.
3. El corazón del home lee del servidor cuando hay sesión y de `localStorage` cuando no.
4. `PlacesView` deja de tener dos fuentes: servidor si hay sesión, local si no.

**Riesgo:** alto si se hace sin migración: se pierden los favoritos que hoy solo existen en el navegador. No ejecutar sin plan de migración y prueba con datos reales.

### Fase D — Limpieza segura (opcional)

1. Onboarding: deshabilitar el botón de resumen mientras guarda y evitar doble envío (`preferences-screen.tsx:77-87`).
2. Onboarding: decidir si «Saltar» puede seguir permitiendo cero selecciones; si no, exigir mínimos también al saltar.
3. Documentar que `/tarjetas` es pública por diseño o protegerla, según §3.4.

## 6. Archivos

**Se modificarían**

- `src/app/(main)/profile/page.tsx`
- `src/components/profile/profile-dock.tsx`
- `src/components/profile/details-view.tsx`
- `src/components/profile/places-view.tsx`
- `src/components/profile/settings-view.tsx`
- `src/components/layout/user-menu.tsx`
- `src/app/api/me/route.ts` (solo si se aprueba la validación)
- `src/app/api/me/places/route.ts` (solo Fase C)

**No se tocan**

- `src/proxy.ts`, `src/lib/session.ts`, `src/app/admin/layout.tsx`, `src/app/(main)/business/layout.tsx`: la autorización ya funciona y no forma parte del rediseño.
- `src/lib/db/schema/*` y migraciones: no hay cambios de esquema en A/B/D.
- `src/app/api/notifications/*`, `src/app/api/tarjeta/*`, `src/app/api/project-requests/*`: se conservan sus contratos.
- `src/components/business/*`: el panel de negocio se preserva; solo se renombra su entrada en el menú.
- Los tests sueltos sin commitear (`pack-medida.test.ts`, `facturas.test.ts`, `pagos-config.test.ts`).

## 7. Pruebas que habrá que ejecutar

- `npm run typecheck`.
- `node --import tsx --test` (55 archivos; no requieren base de datos).
- Prueba manual con sesión: abrir `/profile`, cambiar las cuatro secciones, recargar cada una, usar atrás/adelante, guardar datos, cambiar tema, abrir tarjetas, notificaciones, proyectos y panel de negocio.
- Prueba manual sin sesión: `/profile` debe redirigir a `/login?next=/profile`; `/tarjetas` sigue abierta.
- Prueba de regresión de `POST /api/me` con cuerpos parciales: onboarding, teléfono de Google, términos y marketing no deben borrar preferencias ni provincia.
- No hay lint utilizable: `next lint` se eliminó en Next 16 y no hay ESLint instalado. No se debe presentar como verificación superada.

## 8. Qué queda fuera a propósito

- Cambio de contraseña, 2FA, sesiones/dispositivos y exportación de datos: no existen y no se simulan.
- Avatar editable: `image_url` existe, pero no hay flujo de subida ni decisión de almacenamiento.
- Municipio como preferencia: requiere columna y contrato nuevos.
- Preferencias de pago del usuario: `payments` es del negocio; no se debe reutilizar como si fuera del usuario.
- Historial de pedidos del cliente: no existe. Lo que hay son pedidos recibidos por el negocio.
- Paginación de notificaciones y borrado de avisos: fuera del alcance; hoy el límite es 20 y no hay API de borrado.
