---
target: perfil de usuario (/profile)
total_score: 26
p0_count: 0
p1_count: 3
date: 2026-10-17
slug: src-app-main-profile-page-tsx
---

# Crítica de diseño — Perfil de usuario

**Objetivo:** `src/app/(main)/profile/page.tsx` (336 líneas) con el armazón `ProfileDock`/`MobileDock` y las vistas de sección (`details-view`, `places-view`, `business-view`, `settings-view`).
**Registro:** `product`. **Referencias:** `PRODUCT.md`, `DESIGN.md`, `reference/product.md`.

## 1. Design Health Score

| # | Heurística | Nota | Hallazgo clave |
|---|-----------|-------|----------------|
| 1 | Visibilidad del estado | 2 | El botón dice «Guardado» aunque el guardado haya fallado: el `catch` no dice nada y la marca de éxito siempre llega. |
| 2 | Sistema y mundo real | 3 | «Mis lugares», «Tengo un negocio», «Configuración» se entienden; el mismo destino se llama «Ajustes» en el panel. |
| 3 | Control y libertad | 3 | Se puede cambiar de sección sin perder lo escrito y volver; no hay «descartar» ni deshacer. |
| 4 | Consistencia y estándares | 2 | Dos botones de guardado en la misma pantalla con rótulos distintos, y el de la cabecera se esconde al bajar. |
| 5 | Prevención de errores | 2 | Se escribe el local antes del POST: si el servidor falla, el dispositivo y la cuenta quedan distintos sin que nadie lo sepa. |
| 6 | Reconocer antes que recordar | 3 | Secciones con icono + rótulo y la sección abierta se puede pedir desde la URL. |
| 7 | Flexibilidad y eficiencia | 2 | Sin atajos ni guardado automático; el formulario es largo y el guardado está arriba. |
| 8 | Estética y minimalismo | 3 | Orden, tokens del sistema y un skeleton con la forma del formulario. |
| 9 | Reconocer y recuperar errores | 1 | Un fallo de red al guardar no produce ningún mensaje: se anuncia éxito. |
| 10 | Ayuda y documentación | 2 | Hay textos de ayuda por campo; no hay ayuda para «qué pasa si no guardo». |
| **Total** | | **26/40** | **Acceptable** |

## 2. Anti-patrones

**LLM:** no hay slop visual: nada de degradados decorativos, ni tarjetas anidadas, ni eyebrows numerados. El dock de escritorio —con magnificación por distancia, tooltip y punto de activo— es una pieza con oficio y no una barra de pestañas disfrazada; el comentario del componente explica por qué en móvil se convierte en pastilla plana. El único tic de plantilla es el patrón «cabecera que se esconde al bajar», que aquí esconde justo la acción principal.

**Detector:** `detect.mjs --json src/app/(main)/profile/page.tsx` → `[]`, exit 0.

## 3. Impresión general

El armazón está bien pensado: las tres secciones comparten una sola página, el estado se conserva al cambiar de sección y el título de la cabecera dice dónde estás. Pero el contrato más importante de una pantalla de datos —«si te digo guardado, es que está guardado»— está roto, y una cabecera que se retira al hacer scroll esconde la única acción que el formulario necesita.

## 4. Lo que funciona

1. **El skeleton tiene la forma exacta del formulario** (título + tres campos) y el contenedor lleva `aria-busy`: no hay salto al llegar las preferencias.
2. **Cambiar de sección no pierde lo escrito**: las preferencias viven en el armazón y las vistas se montan con `AnimatePresence`, así que ir a «Mis lugares» y volver deja el formulario como estaba.
3. **La sección activa viaja en la URL con `replaceState`**: un enlace directo a una sección funciona y el botón «atrás» no acumula tres pasos por tres pestañas.

## 5. Problemas prioritarios

### [P1] El botón anuncia «Guardado» aunque el guardado haya fallado
- **Qué pasa:** `handleSave` escribe en `localStorage`, luego hace `POST /api/me`, envuelve todo en `try/catch` con un comentario que asume el fallo… y a continuación, fuera del `if (response.ok)` y del `catch`, ejecuta `setSaved(true)` y el temporizador. El único camino que no dice «Guardado» es que `prefs` sea nulo.
- **Por qué importa:** `PRODUCT.md` lo dice en su principio 3 («nada inventado») y en accesibilidad («un fallo de red dice qué no se guardó en vez de fingir que sí»). Aquí el usuario cambia su teléfono o su ciudad, ve «Guardado», cierra el navegador y el dato se quedó solo en ese dispositivo.
- **Arreglo:** separar los tres estados (`guardando`, `guardado`, `no guardado`), mostrar el error con el texto que ya usa el resto de la app («No se pudo guardar. Revisa la conexión: no se cambió nada.») y reintentar desde el propio aviso.
- **Comando:** `$impeccable harden`

### [P1] La cabecera se esconde al bajar y con ella el botón de guardar
- **Qué pasa:** `TopBar` traduce su `y` a `-100` con opacidad 0 en cuanto el scroll baja (`profile/page.tsx`, efecto de scroll). La acción primaria vive en esa cabecera.
- **Por qué importa:** rellenar el perfil es largo: se baja, se edita, y para guardar hay que volver arriba. En móvil eso es un gesto entero de scroll con el pulgar cada vez, o directamente «¿dónde estaba el botón?».
- **Arreglo:** que el botón de guardar no se esconda —puede quedarse pegado como pastilla flotante cuando hay cambios— y que la cabecera solo se recoja cuando no haya nada pendiente.
- **Comando:** `$impeccable layout`

### [P1] Se escribe primero en local y después en la cuenta, sin conciliación
- **Qué pasa:** `writeUserPreferences(...)` corre antes del `fetch`. Si el `POST` falla, la copia local ya está cambiada y el aviso (roto, ver arriba) dice que todo fue bien.
- **Por qué importa:** el usuario no puede saber si su cambio es real ni desde qué dispositivo lo verá; y el siguiente `mergeRemoteUserPreferences` puede pisarlo sin explicación.
- **Arreglo:** escribir el local solo cuando el servidor confirme, o marcar la copia local como «pendiente de subir» y reintentar en la siguiente visita con un aviso visible.
- **Comando:** `$impeccable harden`

### [P2] Dos botones de guardado con dos rótulos
- **Qué pasa:** la cabecera tiene «Guardar» y el final del formulario «Guardar cambios» (`details-view.tsx`, 213-227). Hacen lo mismo, cambian de estado por separado y compiten por ser la acción primaria.
- **Por qué importa:** dos primarios es ninguno; y el rótulo distinto hace dudar de si guardan lo mismo.
- **Arreglo:** un solo punto de guardado por pantalla (la barra inferior con el conteo de cambios, como en el catálogo) y el mismo verbo en toda la app.
- **Comando:** `$impeccable polish`

### [P2] El mismo destino con dos nombres
- **Qué pasa:** el dock del perfil dice «Configuración» y el panel de negocio dice «Ajustes» para la misma idea; «Tengo un negocio» es una sección del perfil y «Panel» el destino del dueño.
- **Por qué importa:** el dueño entra a las dos superficies el mismo día; dos nombres para lo mismo obligan a aprender dos veces el mismo mapa.
- **Arreglo:** fijar un vocabulario por concepto («Ajustes» o «Configuración», «Perfil» o «Cuenta») y aplicarlo en ambos armazones.
- **Comando:** `$impeccable clarify`

### [P2] Blancos táctiles de 36 px en la cabecera y en las filas de ajustes
- **Qué pasa:** el botón «Volver al inicio» mide `size-9` (36 px) y varios iconos de fila usan también `size-9`.
- **Por qué importa:** es el botón de escape de la pantalla, en la esquina donde el pulgar acierta peor.
- **Arreglo:** 44 px en la cabecera y en cualquier control de fila pulsable.
- **Comando:** `$impeccable adapt`

## 6. Banderas rojas por persona

**Casey (móvil, interrumpida):** cambia su ciudad, baja a revisar los intereses, no encuentra el botón de guardar, sube, guarda, sale… y si la red falló en ese momento nunca lo sabrá; el botón de volver mide 36 px.

**Sam (lector de pantalla):** el cambio de sección no mueve el foco ni anuncia la vista nueva (el `motion.div` con `key={view}` se sustituye sin región viva); el guardado tampoco se anuncia (no hay `role="status"` en el botón).

**Jordan (primerizo):** no sabe si «Guardar» de arriba y «Guardar cambios» de abajo son lo mismo; al salir sin guardar no recibe ninguna advertencia.

## 7. Observaciones menores

- El armazón de carga usa `Skeleton` de `@/components/ui` con `h-[44px]`, coherente con los campos; bien.
- `max-w-lg` para el contenido y `max-w-md` para el skeleton: dos anchos distintos en la misma pantalla.
- La cabecera anima con `motion` sin consultar `useReducedMotion` (otras vistas del proyecto sí lo hacen, p. ej. `business-view`).
- El toast de sesión y los avisos usan `sonner`; el proyecto también tiene `sileo` y el `SaveBar` propio: tres mecanismos de aviso conviven.
- El dock de escritorio muestra el rótulo solo al pasar el ratón; con teclado aparece por `onFocus`, pero el tooltip `text-[11px]` es el texto más pequeño de la pantalla.

## 8. Preguntas para considerar

- ¿Guardar debería ser explícito (una barra con «N cambios sin guardar») o debería el perfil guardarse al salir de cada campo?
- ¿La cabecera debería esconderse en alguna pantalla con formulario, o solo en las de lectura?
- ¿Qué pasa si el servidor rechaza el guardado: se queda pendiente en el dispositivo con aviso, o se revierte a lo último confirmado?
- ¿«Configuración» y «Ajustes» son la misma sección: dos nombres o dos destinos de verdad?

## Run Notes

- slug: `src-app-main-profile-page-tsx` · ignore.md: no existe.
- Independencia: **degradada** (`spawn_agent` no disponible).
- Detector CLI: `[]`, exit 0.
- Navegador: sin evidencia visual (la sesión de desarrollo no tiene negocio y el servidor sirve el fallback de carga en este entorno). Revisado el código del armazón, el dock, la cabecera y `details-view`.
- Temporales: limpiados.
