# Reconocimiento del panel de administración — Fase 0

Documento de trabajo. **No se incluye en ningún commit** (así lo pide el prompt).

Fecha: 24 de noviembre de 2026. Base: rama `fix/admin-planes-y-limpieza-neon`.

---

## 0. El mockup

**No se pudo extraer el código de las dos pantallas.**

Archivo presente en la raíz: `Panel de admin de La Verde   Rediseno.html`
(578 761 bytes; ojo con los espacios del nombre). Es una exportación completa
del navegador, con fuentes de Google incrustadas en `__bundler/manifest` y
JavaScript empaquetado. Búsquedas hechas sobre el archivo:

- `<x-dc>`, `<sc-if>`, `<sc-for>`, `renderVals()`, `class Component extends DCLogic` → **0 coincidencias**.
- `prototipo` → 2; `móvil` → 2. Son apariciones en el texto de la página, no el marcado que describe el prompt.

No hay marcado `<x-dc>` ni una clase `Component` legible: el contenido viene
empaquetado/codificado por el exportador y no se puede leer como texto sin
desempaquetarlo. **Según el prompt, aquí corresponde parar y pedir las fuentes
por separado.** La Fase 1 se hizo igualmente porque su especificación en el
propio prompt es completa y no dependía del mockup; a partir de la Fase 2 hace
falta el código o capturas de las dos pantallas.

El archivo **no está en `public/`**: vive en la raíz del repositorio y no se
sirve. No hace falta moverlo.

---

## 1. Estructura del panel

- Montaje: `src/app/admin/layout.tsx` (servidor). Comprueba `user?.role !== "admin"`
  y redirige a `/login?motivo=rol` (líneas 45–48). Carga en paralelo lugares,
  categorías y catálogo (líneas 66–71) y envuelve con `PlacesProvider` y
  `CatalogoProvider`.
- Armazón: `src/components/admin/admin-shell.tsx`. Barra superior + barra lateral
  de escritorio + cajón `Sheet` en móvil. Aquí no había dock inferior; sí lo hay
  en el panel de negocio (`src/components/business/panel-shell.tsx`) y en el
  perfil, y se reutiliza `src/components/layout/mobile-dock.tsx`.
- Secciones actuales (rutas reales): `/admin` (dashboard), `/admin/analytics`,
  `/admin/negocios` (+ `nuevo`, `[id]/editar`, `[id]/importar`),
  `/admin/solicitudes`, `/admin/publicaciones`, `/admin/proyectos`,
  `/admin/soporte`, `/admin/notificaciones`, `/admin/usuarios`,
  `/admin/afiliados` (+ `[id]`), `/admin/categorias`, `/admin/proveedores-ia`,
  `/admin/prueba-onboarding`, `/admin/planes`, `/admin/diagnostico`.
- Cambio de sección: enlaces (`Link`) a rutas. **No existía ningún `?seccion=`**
  en el panel (búsqueda en `src/app/admin`: 0 coincidencias), así que no hay ids
  antiguos que redirigir. Los filtros y hojas nuevas usarán `searchParams`.
- Rol de admin: en el layout (arriba) para las páginas; en las rutas de API con
  `isAdminRequest` (`src/lib/admin-server.ts:57`), que acepta sesión con rol
  `admin` o la cabecera `x-admin-key`. El proxy (`src/proxy.ts`) solo comprueba
  que hay sesión, nunca el rol.

---

## 2. Sistema de diseño

- Tokens Tailwind: `tailwind.config.ts` (colores `verde-*`, `ink`, `sand-*`,
  `lv-amber`, `destructive`, espaciado `gap-*`, radios `lv*`, sombras
  `soft/card/primary-halo`).
- Escala y patrones documentados: `DESIGN.md` (§1–§10).
- Modo oscuro: `data-theme="dark"` en `<html>`; overrides globales por clase en
  `src/app/globals.css` (a partir de la línea 330). Afectan a
  `:is(.admin-panel, .business-panel, .panel-portal)`, es decir, **el mismo
  mecanismo de overrides por clase que el Business Panel**. Todo portal
  (`SheetContent`, `DialogContent`, `SelectContent`) abierto desde el panel
  necesita `panel-portal`.
- Componentes reutilizados del panel de negocio:
  `src/components/business/ui/clases.ts` (botones, tarjetas, chapitas, inputs),
  `botones.tsx`, `tarjeta.tsx`, `switch.tsx`, `hoja-panel.tsx`.
  El admin ya importa algunos patrones, pero no tenía su propia carpeta `ui/`.
- Componentes del sistema: `ui/sheet.tsx`, `ui/dialog.tsx`, `ui/state-view.tsx`,
  `ui/loading.tsx`, `UserMenu` (`components/layout/user-menu.tsx`), `toast` de
  `sonner` (13 componentes del admin ya lo usan).

### Diferencias con `RECONOCIMIENTO-DISENO.md` (Business Panel)

No se releyó entero; lo comprobado en código coincide: los dos paneles comparten
`.panel-portal` y el bloque oscuro de `globals.css`, y el admin añade
`.admin-panel` a los mismos selectores. No hay un sistema de tokens distinto.

---

## 3. Datos disponibles para las secciones nuevas

| Dato del mockup / fase | Estado | Fuente |
|---|---|---|
| Negocios, plan, estado, destacado | existe | `places` (`src/lib/db/schema/places.ts`) |
| Suscripciones y prueba | existe | `suscripciones` (`schema/suscripciones.ts`) |
| Pagos QvaPay/manuales | existe | `pagos` (`estado`, `metodo`, `montoCentavos`, `pagadoEn`) |
| Solicitudes de negocio | existe | `places.reviewStatus = 'pending'` |
| Solicitudes de proyecto | existe | `project_requests.status = 'pending'` |
| Soporte | existe, **sin asignación** | `support_tickets` (sin `assigned_to`) |
| Publicaciones y cupo | existe | `publicaciones` (`estado`, `semana`, `orden`) |
| Afiliados y comisiones | existe parcial | `users.referralCode`, `users.referredBy`, `afiliado_cobros`, `afiliado_notas`, `afiliado_premios` |
| Analytics (búsquedas, sin resultado) | parcial | `analytics`, `eventos`, `user_search_history`; revisar en Fase 14 si se guarda el término sin resultado |
| Notificaciones enviadas | existe | `admin_broadcasts`, `notifications` |
| Diagnóstico | existe | `diagnosticos` (`tipo`, `datos`, `creadoEn`) |
| Proveedores de IA | existe, en archivo | `src/lib/ai/providers-store.ts` (no en base) |
| Prospectos | **no existe** | tabla nueva (Fase 12) |
| Registro de actividad | **no existía** | creado en esta fase: `admin_actividad` |
| Notas internas por negocio | **no existe** | Fase 4 |
| Respuestas guardadas de soporte | **no existe** | Fase 7 |
| Gasto de IA | no se registra | Fase 17 |
| Liquidaciones de comisiones | no existe | Fase 9 |

---

## 4. Qué falta en el modelo de datos

- Registro de actividad → **hecho** en esta fase (`admin_actividad`, migración
  `0062_admin_actividad.sql`).
- Prospectos, pagos de comisiones a afiliados, asignación de conversaciones,
  respuestas guardadas, notas internas por negocio y gasto de IA: siguen
  pendientes y pertenecen a sus fases.

---

## 5. Riesgos

- `admin-shell.tsx` tenía 15 entradas planas sin grupos y sin contadores; el dock
  móvil no existía en el admin.
- Acciones sin confirmación: `business-list.tsx:150` usa `window.confirm` para
  borrar; las acciones masivas no existen todavía. Las confirmaciones con el
  número exacto llegan con las fases 5, 10 y 15.
- Consultas pesadas: el dashboard `/admin/page.tsx` trae **todos** los negocios
  al cliente (`usePlaces`) y calcula categorías y avisos ahí; los contadores
  nuevos se resuelven en el servidor con `count(*)`.
- «Comisión generada» de Afiliados: no se pudo comprobar el descuadre en esta
  fase. La lógica está en `src/lib/afiliados.ts` y se revisará en la Fase 9 con
  los pagos reales del mes.
- Enlaces externos al panel: ninguno detectado; los enlaces internos apuntan a
  rutas existentes.
