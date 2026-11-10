Vamos a convertir La Verde en una PWA que funcione casi entera sin conexión. Antes, necesito un informe del estado actual. **No modifiques ningún archivo en este paso.**

Lee el código instalado y la configuración del servidor, y respóndeme en español, en este orden:

## 1. PWA actual

- **Manifest:** dónde está y qué tiene (nombre, iconos, `start_url`, `display`, `scope`).
- **Service worker:** si existe, quién lo genera (a mano, `next-pwa`, Serwist u otro), qué cachea y con qué estrategia. Copia la lista de rutas o patrones cacheados.
- **`public/offline.html`:** qué muestra y cómo lee los snapshots.
- **Actualizaciones:** cómo se avisa al usuario de una versión nueva, si se hace.
- **Persistencia:** si se pide almacenamiento persistente (`navigator.storage.persist()`).

## 2. Datos locales

- **`src/lib/offline/store.ts` y `snapshots.ts`:** qué guardan en IndexedDB, para quién (solo dueños o también visitantes) y cuándo se actualizan.
- **Datos del mapa:** cómo se cargan los negocios en el mapa (`places-provider`, rutas de API). Cuántos negocios se descargan de una vez y cuánto pesa esa respuesta.
- **Búsqueda:** cómo funciona (IA, texto, filtros) y qué parte depende del servidor.
- **Ficha y carta:** cómo se cargan la ficha pública y la carta (`/m/[slug]`). Si funcionan sin conexión hoy.
- **Guardados, reseñas y seguidores:** si algo de eso se guarda en local.

## 3. Mapa

- **Librería:** cuál se usa (MapLibre, Leaflet u otra) y su versión.
- **Teselas:** de dónde salen (proveedor, URL, estilo), si son vectoriales o raster y si pasan por la caché del service worker.
- **`src/lib/map/`:** qué hacen `cuba-areas`, `routing` y `map-config`. Si `routing` llama a un servicio externo.
- **Sin conexión:** qué pasa hoy con el mapa al abrirlo sin conexión.

## 4. Escritura sin conexión

Qué acciones del dueño fallan hoy sin conexión: cambiar «Hoy hay», la tasa, guardar la ficha… Si hay alguna cola de reintentos.

## 5. Peso y rendimiento

- Ejecuta `next build` y dame:
  - el tamaño del JS de primera carga de las rutas principales (`/`, `/m/[slug]`, `/business`),
  - las dependencias más pesadas del bundle del cliente.
- Imágenes: formato, tamaños y si hay versiones reducidas (`src/lib/storage/compress.ts`, `optimize.ts`).

## 6. Despliegue en el VPS

- Cómo se ejecuta ahora la app: `next start`, modo `standalone`, PM2 o Docker.
- La configuración de Nginx de La Verde (busca en `/etc/nginx/sites-enabled/` si tienes acceso, o pídeme que te la pegue):
  - compresión (gzip o brotli),
  - cabeceras de caché para `/_next/static`, imágenes y API,
  - HTTP/2,
  - si admite peticiones por rangos (`Range`).
- Espacio libre en el disco del VPS (`df -h`), por si alojamos ahí los archivos del mapa.

## 7. Conclusión

Termina con:
- **Qué funciona sin conexión hoy:** una lista de sí y no por pantalla (mapa, búsqueda, ficha, carta, carrito y pedido, panel del dueño).
- **Los 5 problemas más importantes** que ves para que la app funcione sin conexión, con datos baratos y en teléfonos modestos.
