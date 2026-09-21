# Límite de peticiones: estado actual y qué mirar al escalar

Este archivo no describe lo que hay que hacer hoy, sino lo que cambia el día
que el tráfico y el despliegue crezcan. El límite actual está escrito para un
MVP con una sola instancia, y funciona; lo que sigue son las costuras que se
abren al moverlo de ahí.

---

## 1. Qué hay hoy

`src/lib/rate-limit.ts` es todo el sistema. Un `Map` en memoria del proceso,
con una entrada por cliente, y una función `rateLimit(req, limit, windowMs)`
que devuelve `{ ok }` o `{ ok: false, retryAfterSeconds }`.

La clave es `ip:ruta:ventana`. La ruta entró después: antes era `ip:ventana` y
los tres endpoints de 60 s compartían contador, así que veinte búsquedas de IA
gastaban el presupuesto de las rutas del mapa y cada uno cortaba por el límite
del otro.

**Es ventana fija, no ventana deslizante ni token bucket**, aunque el
comentario de la función diga lo segundo. La ventana arranca con la primera
petición de esa clave y se reinicia entera al cumplirse el plazo: quien agota
el cupo al segundo 59 vuelve a tenerlo entero al 61. Si algún día importa el
reparto fino, es otro algoritmo, no un retoque.

Los límites configurados, tal y como están en el código:

| Endpoint | Límite | Ventana | Para qué |
|---|---|---|---|
| `/api/ai` | 20 | 60 s | El asistente consume tokens de pago |
| `/api/ai/search` | 15 | 60 s | Igual: es una llamada al LLM |
| `/api/route` | 30 | 60 s | Protege la cuota del servidor de rutas |
| `/api/admin/verify` | 10 | 15 min | Frena la fuerza bruta contra la clave de admin |
| `/api/waitlist` | 3 | 1 h | Evita spam en los datos de contacto |

**Dónde no está.** De los 18 endpoints, 13 no llevan límite. La mayoría son
lecturas baratas y da igual. Dos no lo son y conviene tenerlos fichados:

- `POST /api/places/[id]/images` — sube fotos al bucket. Cada petición cuesta
  almacenamiento y ancho de banda, y no hay freno por IP.
- `src/proxy.ts` — ni el proxy ni ninguna capa anterior limita nada. Todo el
  freno vive dentro de cada handler, que ya se ha ejecutado cuando decide
  cortar.

---

## 2. Qué se rompe al escalar

Por orden en que aparece, no por gravedad:

1. **Varias instancias multiplican el límite.** El `Map` es del proceso. Con
   tres instancias, `/api/route` no son 30/min sino 90/min repartidos de forma
   impredecible según a cuál caiga cada petición. Y al revés: un usuario puede
   recibir 429 de una instancia mientras la siguiente le deja pasar.
2. **El arranque en frío pone el contador a cero.** Todo el estado se pierde
   cada vez que una instancia se recicla.
3. **Es por IP, no por cuenta.** Una red compartida —un café, una escuela, una
   oficina— gasta un cupo común: el que abusa castiga a los demás. Y quien
   cambia de IP (datos móviles) reinicia su cupo sin proponérselo.
4. **`x-forwarded-for` la escribe quien llama, no el servidor.** `clientIp()`
   lee la primera entrada de esa cabecera y se fía. En una plataforma que la
   sobrescriba al entrar —Vercel lo hace— está bien; en un hosting que la deje
   pasar, basta con inventarse la cabecera en cada petición para no tener
   límite ninguno. **Esto hay que comprobarlo contra el hosting real antes de
   confiar en el límite para nada.**
5. **La caché de rutas no ahorra contador.** `/api/route` guarda un día por
   par origen-destino, así que repetir la misma ruta no vuelve a salir al
   servidor de OSRM. Pero la comprobación del límite corre antes, así que esa
   petición repetida sí gasta presupuesto del minuto.
6. **No hay límite diario ni cuota por usuario.** Lo que existe es un freno
   por minuto contra ráfagas, no un techo de gasto por persona.

---

## 3. Qué hacer cuando toque, por peldaños

No todo a la vez. Cada peldaño se sostiene solo y el siguiente solo hace falta
si el problema aparece.

**Peldaño 1 — almacén compartido.** Es el salto de verdad: mover el `Map` a un
Redis o a un KV (Upstash y compañía). Misma lógica, pero el contador es uno
para todas las instancias y sobrevive a los reciclados. Consecuencia en el
código: `rateLimit()` hoy es **síncrona**, y pasa a ser asíncrona, lo que toca
a los cinco llamantes de golpe porque cada uno necesita `await`. Hazlo en un
solo commit y con los cinco a la vista, no endpoint a endpoint.

De paso, ahí sí merece la pena cambiar la ventana fija por una deslizante: el
almacén ya lo aguanta.

**Peldaño 2 — límite por cuenta, no solo por IP.** La sesión ya se resuelve con
`getAppUser()` (`src/lib/auth/user.ts`). Un contador por cuenta protege de
verdad; el de IP se queda como red de seguridad para los anónimos, que son
justo los que no se pueden identificar.

**Peldaño 3 — cuota diaria persistente.** Para un techo de gasto real hace
falta un contador que no viva en memoria: una tabla en Neon con `(usuario,
día, contador)`. Es el único almacén persistente que hay montado; no hay Redis
ni KV en el proyecto.

Antes de escribirlo hay que decidir dos cosas, y ninguna la resuelve el código:
qué cuenta como gasto —¿toda petición, o solo las que salen al proveedor?— y
si las respuestas servidas de caché consumen cuota. Con la caché de rutas de
por medio, la respuesta a la segunda cambia mucho el número.

**Peldaño 4 — frenar en el punto donde se gasta.** Si el problema acaba siendo
el dinero, el límite importa menos que la caché y que el sitio donde se compra:
limitar antes de llamar al proveedor y ampliar lo cacheado da más margen que
apretar el contador. Y si algún día hay CDN o proxy propio delante, el límite
puede vivir ahí, que es más barato y corta antes de gastar una invocación.

---

## 4. Señales de que ya toca

- **429 en los logs.** Ninguno todavía. El primero es el aviso.
- **Quejas del tipo "no me deja buscar"** sin que el usuario haya hecho nada
  raro: suele ser cupo compartido por IP en una red común.
- **Más de una instancia en producción.** En cuanto el hosting escale, el
  peldaño 1 deja de ser opcional.
- **Factura del proveedor de IA o de rutas subiendo sin que suban los
  usuarios**, que es abuso y no crecimiento.

---

## 5. Detalles que muerden

- El `Map` no se limpia solo. `prune()` solo actúa al crear una clave nueva y
  solo cuando ya pasa de 5000 entradas, y entonces borra las caducadas hasta
  bajar de la mitad. Entre medias, la memoria crece con cada IP distinta que
  aparezca. En un MVP da igual; con tráfico ancho, es una fuga lenta.
- El límite de admin (`/api/admin/verify`) protege la clave de administración y
  es el único de los cinco donde un fallo se paga en seguridad, no en dinero.
  Si se mueve de sitio, que sea con cuidado.
- Los cinco `tooMany()` están copiados en cada endpoint. No hay una respuesta
  429 común. No molesta hasta que haya que cambiar el formato del error.
- Nada de esto está cubierto por pruebas. El repo no tiene ningún test montado.
