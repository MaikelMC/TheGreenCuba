# La Verde

Plataforma de descubrimiento de lugares en Cuba, con búsqueda por lenguaje
natural. Next.js 16 con App Router, Neon (Postgres) y autenticación en Neon.

---

## 1. Cómo trabajar en este proyecto

### Idioma y estilo

Responde **siempre en español**. El usuario escribe en español y no cambia.

Mantén activos **los dos modos a la vez**, siempre, en cada respuesta:

- **Caveman, nivel `ultra`.** Comprime la prosa al máximo: fuera artículos,
  muletillas, cortesías y matices. Una idea por frase. Nunca quites `no`,
  `solo`, `excepto` ni cifras — comprimir no puede cambiar el significado.
  Si la forma comprimida no es más corta que la normal, usa la normal.
  **Se apaga** para advertencias de seguridad, confirmaciones de acciones
  irreversibles y secuencias donde el orden importa. Vuelve a activarse
  después.
- **Ponytail, nivel `full`.** Antes de escribir código, sube la escalera:
  ¿hace falta que exista? ¿ya está en el repo? ¿lo resuelve la stdlib, una
  función nativa de la plataforma, una dependencia ya instalada? La vía más
  corta gana. Borrar antes que añadir. Sin abstracciones no pedidas, sin
  andamiaje "para después". El código se entrega primero y se explica en
  tres líneas como mucho.

Los dos modos gobiernan **solo lo que te digo a ti y lo que construyes**.
**No** se aplican al código, a los comentarios, a los mensajes de commit, a la
documentación ni a los textos para terceros: ahí va prosa normal.

### Reglas de trabajo

- **No arranques el servidor de Next.** El usuario lo levanta él. Tú no.
- **No conduzcas el navegador.** Nunca. Ni con herramientas ni con capturas.
- **No escribas scripts de prueba** ni archivos temporales. Si de verdad hace
  falta uno para comprobar algo, créalo y bórralo en el mismo comando.
- **No uses agentes ni subagentes.** Explora con Read, Grep y Glob.
- **No escribas Python.**
- **Avisa al terminar cada tarea.** El usuario ha pedido esto muchas veces.

### Verifica contra el código, no contra la documentación

Vale para cualquier API de terceros. En este proyecto, **dos errores propios
salieron de dar por buena la documentación**: un método que la doc no
mencionaba (el handler de Neon exporta cinco verbos, no dos) y una variable de
entorno que la doc de Vite describe y que aquí no existe ni hace falta (el
cliente de auth acaba con `baseURL: undefined`).

Antes de tocar una API: lee el `.d.ts` o el fuente dentro de `node_modules`.
La documentación va por detrás de la versión instalada.

---

## 2. Stack y trampas

### Next.js 16

- **App Router, y solo App Router.** No existe `pages/`. Nunca propongas la
  estructura de Pages Router.
- Turbopack es el bundler por defecto, en `build` **y** en `dev`. Necesita el
  binario nativo `@next/swc-win32-x64-msvc`. Si npm lo poda en un rollback,
  tanto `next build` como `next dev` mueren con
  `Turbopack is not supported on this platform`.
- `middleware.ts` **ya no se llama así**. Aquí es `src/proxy.ts`, y a
  diferencia del middleware antiguo corre en **Node**, no en Edge.
- `next lint` **se eliminó**. El script `npm run lint` del `package.json`
  apunta a un comando que ya no existe: está roto. Para comprobar tipos, usa
  `npm run typecheck` (`tsc --noEmit`), que sí funciona.

Comandos que sirven:

| Comando | Qué hace |
|---|---|
| `npm run dev` | servidor de desarrollo (lo levanta el usuario, no tú) |
| `npm run build` | build de producción |
| `npm run typecheck` | `tsc --noEmit` — tu comprobación de referencia |
| `npm run db:generate` | genera migración a partir del esquema |
| `npm run db:seed` | siembra la base |
| `npm run format` | Prettier |

React 19, TypeScript 5.7, alias `@/*` apuntando a `src/*`.
Tailwind 3.4 con Radix, `lucide-react` para iconos, `motion` para animación,
y `sileo` junto a `sonner` para notificaciones.

### Base de datos

Neon Postgres con `@neondatabase/serverless` y `drizzle-orm`.

El esquema vive en `src/lib/db/schema/` (un archivo por tabla) y las
migraciones en `src/lib/db/migrations/`.

**`src/lib/db/migrations/meta/` NO se ignora, y es a propósito.** Estuvo
ignorado y era un error: no lleva secretos —son instantáneas del esquema en
JSON y el `_journal.json`—, y es justo lo que Drizzle necesita. `generate` lo
compara con el esquema para saber qué cambiar, así que sin él la migración
siguiente duplicaría los `ALTER` ya aplicados; y `migrate` lee el
`_journal.json` para saber cuáles ya corrieron. No vuelvas a añadirlo al
`.gitignore`.

Tres trampas de Drizzle ya sufridas aquí:

- `db.execute<T>` exige un **alias de tipo**, no le vale una `interface`.
- Dos `.where()` encadenados **se reemplazan, no se combinan**. Para un AND de
  verdad, mete las dos condiciones en un solo `.where()`.
- El `sql.query()` de Neon devuelve un **array plano de filas**, no un objeto
  con `.rows`.

Y una de `drizzle-kit`: `generate` **se vuelve interactivo** cuando detecta una
columna que desaparece y otra que aparece a la vez, porque pregunta si es un
renombrado o una creación. No sirve pasarle un salto de línea por stdin. Se
resuelve en dos pasos.

### Autenticación

Neon Managed Better Auth, con `@neondatabase/auth` en versión `0.5.0-beta`.
Ese paquete **exige Next >= 16** — es lo que forzó la subida de framework.

Cómo está montado:

- `src/lib/auth/server.ts` — la instancia de servidor (`createNeonAuth`).
- `src/lib/auth/client.ts` — la instancia de navegador. **`createAuthClient()`
  va sin argumentos**: en Next el cliente resuelve su propia URL. Pasarle una
  es la firma del cliente SPA de React y aquí estaría mal.
- `src/lib/auth/user.ts` — el puente entre Neon y nuestra tabla `users`.
  `getAppUser()` busca la fila por `authUserId` y **la crea si no existe**.
- `src/app/api/auth/[...path]/route.ts` — el catch-all que proxea a Neon.
  Exporta **cinco** verbos: `GET, POST, PUT, PATCH, DELETE`.
- `src/proxy.ts` — comprueba **solo que hay sesión**, nunca el rol. El rol se
  comprueba en el layout de cada zona (`/admin`, `/business`).

**El navegador nunca habla con Neon.** `createAuthClient()` se construye sin
URL, el adaptador acaba pasando `baseURL: undefined`, y Better Auth sin
`baseURL` usa el origen actual. Todas sus llamadas van a `/api/auth/*` en este
mismo dominio, y quien habla con Neon es el catch-all, en el servidor.

Esto explica por qué el CSP tiene `connect-src 'self'` y **no** un origen de
Neon: si algún día alguien añade algo que sí llame a Neon desde el navegador
(los componentes de `@neondatabase/auth-ui`, que aquí no se usan), el CSP es
lo primero que hay que tocar, o el navegador lo bloqueará en producción con un
error que no menciona el CSP por ninguna parte.

Variables, y son **dos más una**:

```
NEON_AUTH_BASE_URL        # URL de auth de vuestra rama; termina en /auth
NEON_AUTH_COOKIE_SECRET   # firma la cookie, mínimo 32 caracteres
AUTH_BOOTSTRAP_ROLES      # correo=rol, separado por comas
```

Sin las dos primeras **el build falla en seco**, porque Next evalúa los
módulos al recoger la información de rutas. No es un aviso.

`AUTH_BOOTSTRAP_ROLES` **se aplica solo la primera vez**, al crear la fila en
`users`. Después el rol se cambia con un `UPDATE` en la tabla, no ahí. Es el
único punto de entrada que existe para tener un administrador: sin esa
variable, `/admin` y `/business` quedan cerrados para siempre.

Ojo con el fallo silencioso: si el correo no está en la variable **antes** de
registrarse, el alta funciona igual y luego la zona no abre. No da error.

---

## 3. Seguridad

**Nunca imprimas credenciales enteras.** Si hay que referirse a una, se
enmascara (`sk-abc...xyz`). Esto vale para las claves de IA, para las de
Cloudflare, para el `DATABASE_URL` y para el secreto de la cookie.

Están fuera de git, y debe seguir así:

| Ruta | Qué contiene |
|---|---|
| `.env` | todas las claves del proyecto |
| `data/` | claves de los proveedores de IA |
| `Cloudflare/` | identificadores de la cuenta de Cloudflare |
| `groq-for-claude-code/` | un repo git anidado, con su propio `.git` y su `.env` |
| `CREDENCIALES-DEMO.md` | credenciales de las cuentas demo, en claro |
| `/.clerk/` | configuración de Clerk |

`Cloudflare/IDs.txt` contiene un **token de cuenta completa de Cloudflare**, no
uno limitado al permiso de Workers AI. Para producción habría que acotarlo.
No lo reproduzcas nunca.

`groq-for-claude-code/` es un **repositorio git anidado**. Estuvo commiteado
como gitlink y el `.gitignore` no lo alcanzaba. Ya se sacó del índice; no lo
vuelvas a meter.

**Antes de cualquier commit**, comprueba que `.env` y `data/` no aparecen en
`git status`. Las claves del `.env` nunca son candidatas a subir.

---

## 4. Entorno: red hostil

Esta máquina tiene una red poco fiable. Casi todas las rarezas de este
proyecto salen de ahí.

### El puerto 5432 ya no está bloqueado

El puerto de Postgres estuvo cerrado desde esta red y **dejó de estarlo**.
Comprobado el 24 de septiembre de 2026: `npm run db:migrate` conecta a Neon y
aplica la migración. `push` y `studio` usan ese mismo puerto, así que también
deberían funcionar, aunque desde entonces no se han probado.

`drizzle-kit generate` sigue siendo **offline** —compara el esquema con las
instantáneas de `migrations/meta/` y no sale a la red—, y es el camino que hay
que usar de todas formas.

**No mezcles `push` con `migrate`.** `push` no escribe en
`drizzle.__drizzle_migrations`, así que deja la base con el esquema nuevo y el
historial creyendo otra cosa. Es exactamente lo que había aquí: las migraciones
0000–0006 se aplicaron fuera de banda, la tabla de control quedó **vacía**, y
`db:migrate` intentaba replay desde 0000 para morir en
`relation "business_owners" already exists`.

Si ese error reaparece, **no falta nada: falta el sello.** Compara el esquema
real (`information_schema`) contra el último snapshot de `migrations/meta/`
—el de la migración más alta— y, si coinciden, marca las aplicadas insertando
en `drizzle.__drizzle_migrations` el sha256 del `.sql` y el `when` de su
entrada del `_journal.json`. El migrador solo compara el `created_at` de la
fila más reciente, así que lo que importa es el orden. Re-ejecutarlas no es la
reparación. Y al sellar, detente en la última **ya aplicada**: el 24/09 el
bucle incluyó la migración nueva, la marcó como aplicada sin ejecutarla, y hubo
que borrar esa fila.

### `registry.npmjs.org` falla a ratos

Síntomas vistos: `ECONNRESET` al bajar tarballs grandes y `ENOTFOUND` cuando
el DNS se cae entero durante un rato.

**npm es todo o nada.** Un fallo en cualquier punto dispara un rollback
completo y destruye la instalación entera; el progreso solo se acumula en la
caché de descarga. Y ese rollback **poda dependencias opcionales**, que es
como se perdió `@next/swc-win32-x64-msvc` y se rompió el build.

Lo que funcionó, y sirve de receta:

1. Bajar el `.tgz` con `curl` resumible
   (`--speed-limit 2000 --speed-time 30`).
2. **Verificar el sha512 contra el hash del registro** antes de usarlo.
3. `npm cache add` del archivo ya verificado.
4. Instalar con `--prefer-offline`.

Dos trampas propias, para no repetirlas:

- **`--prefer-offline` puede leer un packument viejo** y dar un `ETARGET` por
  una versión que sí existe. Si aparece un `ETARGET` raro, refresca con
  `--prefer-online` y vuelve a intentarlo.
- **No pongas un `--fetch-timeout` gigante.** Se puso una vez de 30 minutos
  para los tarballs grandes y lo que hizo fue que cada consulta de metadatos
  muerta esperase media hora. Deja el timeout corto, 45 segundos.

Y un aviso de diagnóstico: al filtrar la salida de npm, cuidado con quedarse
con las primeras líneas. Las líneas `npm error` reales van **después** de los
avisos `ERESOLVE`, así que un `head` corto las tapa y el error que ves no es
el que ocurrió.
