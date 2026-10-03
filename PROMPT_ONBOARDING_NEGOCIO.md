# Onboarding con bifurcación: usuario normal o negocio

## Contexto

Proyecto **La Verde** (`C:\Users\maike\OneDrive\Desktop\MVP\Project`).
Next.js 16 (App Router), React 19, TypeScript 5.7, Tailwind 3.4, `motion/react`,
`sonner`, `lucide-react`. Base Neon con Drizzle.

**Lee `CLAUDE.md` en la raíz del repo antes de empezar.** Ahí están las reglas
de trabajo, las trampas del stack y la definición de terminado. Resumen de lo
que te afecta: no arranques el servidor de Next (lo levanta el usuario), no
conduzcas el navegador, no escribas scripts de prueba ni archivos temporales,
no uses subagentes, y verifica con `npm run typecheck` (`npm run lint` está
roto, apunta a un comando que Next 16 eliminó).

**Esta tarea no toca base de datos, ni migraciones, ni rutas de API nuevas.**
Todo lo que hace falta ya existe. Si te encuentras escribiendo un `.sql`, para
y revisa: te has salido del encargo.

---

## Objetivo

Hoy, quien se registra cae en `/onboarding` y ve cuatro pantallas de
preferencias (ciudad, intereses, monedas, ambiente) y un resumen final.

Lo que se quiere: **añadir una pantalla antes, que pregunte qué es el usuario.**

- Si elige **usuario normal** → el onboarding de hoy, sin cambios.
- Si elige **tengo un negocio** → una pantalla de ciudad, y después las seis
  secciones del formulario de alta de negocio, una por pantalla, y al final una
  confirmación de «solicitud enviada» que lo deja en `/home`.

## Flujo exacto

```
 Splash (WelcomeSplash)
        │
        ▼
 ┌──────────────────────┐
 │  ¿Qué eres?          │   ← pantalla nueva, sin barra de progreso
 │  ○ Usuario normal    │
 │  ● Tengo un negocio  │
 └──────────────────────┘
        │
        ├─────────────── usuario normal ───────────────┐
        │                                              ▼
        │                                   Ciudad → Intereses →
        │                                   Monedas → Ambiente →
        │                                   Resumen → /home
        │                                   (los 4 pasos de hoy, intactos)
        │
        └─────────────── tengo un negocio ─────────────┐
                                                       ▼
                                            Ciudad → Lo esencial → Dónde está →
                                            Contacto → Cómo te encuentran →
                                            Métodos de pago → Tu plan →
                                            «Solicitud enviada» → /home
                                            (7 pantallas + confirmación)
```

La pantalla de elección **no cuenta como paso**: es una bifurcación, no un
avance. No lleva `StepBar`.

---

## Archivos

### 1. `src/app/onboarding/page.tsx` (hoy 981 líneas) — el orquestador

Es un componente de cliente con el estado del flujo: `splashDone`,
`showOnboarding`, `showPreferences`, `currentStep` (0..3), `animTick`, y los
`Set` de intereses/monedas/ambientes.

Añade un estado de ruta:

```ts
/* `null` = todavía no eligió. La elección no es un paso más: bifurca. */
const [path, setPath] = useState<"user" | "business" | null>(null);
const [businessStep, setBusinessStep] = useState(0);
const [businessSubmitted, setBusinessSubmitted] = useState(false);
```

Orden de render:

1. `splashDone === false` → `WelcomeSplash` (igual que hoy).
2. `path === null` → la pantalla de elección (nueva).
3. `path === "user"` → `setShowOnboarding(true)` y todo el bloque actual, **sin
   tocar nada**: los `<Slide>`, `StepBar`, el botón «Saltar», `StepDots`, la
   navegación inferior y `PreferencesScreen`.
4. `path === "business"` → el asistente nuevo.

Al elegir «usuario normal» llama `setPath("user")` y `setShowOnboarding(true)`.
Al elegir «negocio» llama `setPath("business")`.

**El botón «Saltar» del camino de negocio.** El camino de usuario ya tiene
escape («Saltar» salta al resumen y de ahí a `/home`). El de negocio también
tiene que tenerlo o el usuario queda atrapado en siete pantallas: pon «Ahora
no» en las pantallas del formulario, que marca el onboarding como completado y
lo deja en `/home` **sin crear ningún negocio**.

### 2. `src/components/onboarding/type-choice.tsx` — **nuevo**

La pantalla de elección. Componente de cliente.

Dos tarjetas grandes, al estilo de `src/components/business/business-entry.tsx`
(que ya resuelve el mismo problema visual: una tarjeta clara y una oscura, con
icono, título, descripción y una línea de acción). Reusa esa forma; no inventes
otra.

- **Usuario normal** — icono `Compass` o `UserRound`. Título: «Solo quiero
  explorar». Texto: busca y guarda lugares cerca de ti.
- **Tengo un negocio** — icono `Store`. Título: «Tengo un negocio». Texto:
  publica tu local en el mapa y gestiónalo desde aquí.

Requisitos de interacción (no negociables):

- Cada tarjeta es un `<button type="button">` con área de toque muy por encima
  de 44×44 px, foco visible (`focus-visible:ring-2 focus-visible:ring-verde-400`)
  y `active:scale-[0.98]`.
- El texto va en el botón, no en un icono suelto.
- Nada de `div` con `onClick`: tiene que funcionar con teclado y leerse con
  lector de pantalla.
- Usa los tokens del proyecto: `font-lv-display`, `text-h2` para el titular,
  `gap-gap-md`, `rounded-[24px]`, `bg-verde-400 text-verde-950` para la acción
  primaria, `shadow-soft`. Nada de colores en hex crudo.

Recibe por props `onChoose: (path: "user" | "business") => void`.

### 3. `src/components/onboarding/location-screen.tsx` — **nuevo**

El cuerpo del paso 0 actual («¿Dónde estás?»: el `<SlideIcon>`, el titular, el
párrafo, `<ProvinceMap>` y `<LocationPicker>`) está escrito en línea dentro de
`onboarding/page.tsx`. **Extráelo aquí** y úsalo en los dos caminos: el de
usuario no cambia de aspecto, y el de negocio lo reutiliza como su primera
pantalla.

Props: `location`, `onSelect`, `gpsDetected`, `gpsLabel`, `onUseGPS`. Es
exactamente lo que hoy consume `<LocationPicker>` más el encabezado.

No cambies su contenido ni su copy. Solo muévelo.

### 4. `src/components/profile/business-view.tsx` (hoy 926 líneas) — el formulario

Aquí vive `BusinessForm`, que hoy pinta las seis secciones seguidas con un
botón «Dar de alta mi negocio» al final y un estado `submitted` con la tarjeta
de confirmación.

**No lo dupliques.** Añade un modo:

```ts
variant?: "page" | "wizard";   // por defecto "page" = comportamiento de hoy
step?: number;                 // solo en "wizard"
onSubmitted?: () => void;      // se llama tras un POST correcto
onStepChange?: (step: number) => void;
```

Refactor mínimo para que esto sea posible:

a. Convierte el cuerpo de cada `<FormSection>` en un nodo de un mapa
   `Record<SectionId, ReactNode>`, y los títulos/iconos en una lista ordenada.
   Los identificadores y títulos **ya existen** en la constante `SECTIONS`:
   `esencial`, `ubicacion`, `contacto`, `horario`, `pagos`, `plan`. Reúsala, no
   escribas una segunda lista.

b. En modo `"page"`, recorre el mapa entero igual que hoy. En modo `"wizard"`,
   pinta solo el paso activo.

c. **Validación por paso.** Hoy `submit()` comprueba todo y avisa de todas las
   secciones que faltan de golpe. En modo asistente, cada paso valida lo suyo:

   ```ts
   function stepIsValid(id: SectionId): boolean {
     if (id === "esencial") return name.trim().length > 0;
     if (id === "ubicacion") return location !== null;
     return true;   // contacto, horario, pagos y plan no tienen obligatorios
   }
   ```

   Esos dos son los únicos campos obligatorios que ya tenía el formulario. No
   inventes obligatorios nuevos.

d. En modo `"wizard"`, `submitted === true` ya no pinta el paso activo sino la
   confirmación. Añádele un titular explícito **«Solicitud enviada»** por encima
   del bloque actual («Espera menos de 24 horas» + el enlace «Volver al mapa» a
   `/home`), porque pasa a ser la última pantalla del flujo y tiene que leerse
   como un final. El enlace a `/home` ya está: déjalo.

e. Llama `onSubmitted?.()` justo después de `setSubmitted(true)`, en el camino
   de éxito del POST.

**No toques**: la construcción del cuerpo del POST (la categoría viaja como
**etiqueta** —«Restaurante»—, no como slug, porque `resolveCategoryId` busca por
nombre en el servidor), ni `onResolved` del mapa, ni las clases `INPUT`/`LABEL`,
ni el bloque de planes.

### 5. Nada más

`/onboarding` ya está en `PROTECTED_PREFIXES` y en `needsAppUser`
(`src/lib/session.ts`), así que el proxy ya le pasa la identidad. **No toques
`src/proxy.ts`.** No añadas dependencias: `motion/react` y `lucide-react` ya
están.

---

## Detalles que no se pueden improvisar

### El guardado final: `POST /api/me` borra lo que no le mandes

Esta es la trampa de la tarea. En `src/app/api/me/route.ts` (líneas ~210-216):

```ts
locationCity: nextLocation ?? nextLocationName ?? null,
preferences: { interests: …, moods: …, currencies: … },
onboardingCompleted: nextOnboarding ?? false,
```

**Los tres se sobrescriben siempre con lo que llegue.** Un `POST /api/me` con
solo `{ onboardingCompleted: true }` deja la ciudad del usuario a `null`, sus
preferencias vacías y —si además olvidas el campo— el propio onboarding en
`false`, con lo que el usuario vuelve a empezar en bucle.

Por eso el remate del camino de negocio tiene que mandar **el mismo cuerpo que
manda hoy `handleDone`**: `name`, `email`, `location`, `locationName`,
`interests`, `moods`, `currencies` y `onboardingCompleted: true`.

Los `Set` de intereses, monedas y ambiente arrancan con valores por defecto en
el estado del componente (`cultura`/`playas`, `mlc`/`cup`,
`tranquilo`/`romantico`), así que en el camino de negocio viajan esos y no
queda vacío. La ciudad es la que el usuario acaba de elegir en la pantalla
nueva. Reutiliza la función `handleDone` que ya existe en
`src/app/onboarding/page.tsx` en vez de escribir una segunda versión del
guardado.

### Dos peticiones al final del camino de negocio, en este orden

1. `POST /api/business` (lo hace `BusinessForm`) → crea la ficha.
2. `POST /api/me` (lo dispara `onSubmitted`) → marca `onboardingCompleted: true`
   y guarda la ciudad.

Si la segunda falla, el usuario queda en `/home` con el negocio creado y el
onboarding a medias. Avisa con `toast.error` y no lo dejes en el mismo sitio sin
decir nada.

### El negocio nace pendiente

`/api/business` crea la ficha con `isActive: false` y `reviewStatus: "pending"`,
y sube al usuario de `user` a `owner`. **No se publica nada.** Lo aprueba un
administrador desde `/admin/negocios`, y hasta entonces `/business` rebota al
perfil con la tarjeta de «Pendiente de revisión». La confirmación ya lo dice;
no prometas que el negocio aparecerá en el mapa.

### El cambio de rol no puede romper nada

Tras el POST el rol del usuario pasa a `owner`. No añadas ninguna condición que
dependa de que siga siendo `user`.

### Reutiliza el vocabulario visual del onboarding

El asistente de negocio tiene que parecer el mismo producto que el onboarding,
no el formulario del perfil metido en una caja:

- `OnboardingShell` + `StatusBar` envolviendo todo.
- `StepBar` para el progreso, con `totalSteps` = 7 (ciudad + 6 secciones).
- Las animaciones de entrada por capas: `SlideContent` con `delay` escalonado
  (50/100/150/200 ms) y `animate-fade-up`.
- La navegación inferior, con los mismos estilos que los botones «Atrás» y
  «Continuar» actuales.
- `motion/react` ya está importado en el proyecto; úsalo igual que
  `business-panel.tsx` (transición `[0.22, 1, 0.36, 1]`, 250-300 ms).

La única pieza del formulario que se queda fuera del armazón es `FormSection`,
que ya se usa en el perfil: en modo asistente envuélvela o sustitúyela por el
encabezado del paso, pero no mezcles los dos lenguajes.

### Accesibilidad y feedback (reglas de UI del proyecto)

- Valida el paso en cuanto se pulsa «Continuar» y lleva el foco al campo que
  falta; no solo pintes un aviso arriba.
- Todo campo con `<label htmlFor>`. Ya lo tienen: no los degraden a
  `placeholder` suelto al reorganizarlos.
- El estado de envío: `Loader2` girando mientras se envía, y después éxito o
  error. Nunca un botón que no responde.
- Respeta `prefers-reduced-motion` en las transiciones nuevas.
- `Scroll` por paso: cada pantalla scrollea sola (`overflow-y-auto
  scrollbar-hide`, como el `Slide` actual) y la barra de navegación queda fija
  abajo.

---

## Prohibiciones

- No crees tablas, columnas, migraciones ni rutas de API.
- No dupliques el formulario de negocio: un solo sitio declara los campos.
- No toques `src/proxy.ts`, `src/lib/session.ts` ni el middleware de puertas.
- No añadas dependencias nuevas.
- No inventes campos obligatorios que el formulario no exigía.
- No cambies el copy del onboarding de usuario ni el resumen de preferencias.
- No arranques `npm run dev` ni abras el navegador.
- No amplíes el alcance a «registrar proyecto» (`ProjectRegistrationForm`):
  esta tarea es solo negocio o usuario normal.

## Criterios de aceptación

1. Un usuario nuevo entra en `/onboarding` y lo primero que ve, tras el splash,
   es la elección entre usuario normal y negocio.
2. «Usuario normal» lleva al onboarding de hoy y termina en `/home` con las
   preferencias guardadas, exactamente como antes.
3. «Tengo un negocio» lleva a la ciudad, y después a las seis secciones, una
   por pantalla, con barra de progreso de 7 y navegación Atrás/Continuar.
4. No se puede avanzar de «Lo esencial» sin nombre ni de «Dónde está» sin
   punto en el mapa, y el aviso dice qué falta y dónde.
5. «Tu plan» termina en «Solicitud enviada» y el botón deja al usuario en
   `/home`.
6. Al volver a `/onboarding`, el usuario **no repite el flujo**: se va directo a
   `/home` (lo decide `onboardingCompleted`).
7. `npm run typecheck` pasa limpio.
8. `git status` no muestra `.env` ni `data/`.

## Verificación

Con el servidor que levante el usuario:

1. Cuenta nueva → `/onboarding` → elegir «Solo quiero explorar» → terminar →
   `/home`. Comprobar en el perfil que la ciudad y las preferencias están.
2. Cuenta nueva → `/onboarding` → elegir «Tengo un negocio» → recorrer las 7
   pantallas → ver la confirmación → `/home`.
3. Recargar `/onboarding`: debe rebotar a `/home`, sin volver a preguntar.
4. Con la cuenta anterior, entrar en `/profile?seccion=negocio`: la ficha sale
   como «Pendiente de revisión».
5. Con una cuenta de administración, `/admin/negocios`: la solicitud aparece.
6. Escribir mal los datos de la segunda pantalla y pulsar Continuar: el aviso
   tiene que decir qué falta y la pantalla no debe avanzar.

## Presupuesto

Unas 2-3 horas. El grueso es el refactor de `BusinessForm` para admitir el modo
asistente sin duplicar los campos; el resto es composición con piezas que ya
existen.
