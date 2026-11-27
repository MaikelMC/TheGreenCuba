/**
 * Prebuild: escribe public/sw-version.js con la versión del service worker.
 *
 * La versión es un hash del **contenido** de `sw.js` y `offline.html`, no la
 * fecha del build. Antes era la hora del build y eso hacía que cada despliegue
 * —aunque solo cambiara el texto de una pantalla— se anunciara en todos los
 * clientes como «Hay una versión nueva». El aviso llegaba a molestar: la app
 * se actualiza sola por navegación (el SW sirve los documentos en red primero)
 * y solo hace falta reinstalar el SW cuando cambia lo que de verdad guarda
 * para funcionar sin conexión.
 *
 * Si algún día hay que forzar la actualización de todos los clientes, se toca
 * `public/sw.js` (por ejemplo, subiendo `CACHE_VERSION`) y el hash cambia.
 *
 * El service worker importa este archivo con importScripts('/sw-version.js')
 * y lo usa como CACHE_VERSION. El navegador detecta el cambio porque rastrea
 * los scripts importados: si sw-version.js cambia, instala un SW nuevo.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

/** Lo que el SW precachea y no viene del build de Next. */
const ARCHIVOS = ["sw.js", "offline.html"].map((nombre) =>
  path.join(__dirname, "..", "public", nombre),
);

const hash = crypto.createHash("sha256");
for (const archivo of ARCHIVOS) hash.update(fs.readFileSync(archivo));

const version = "lv-" + hash.digest("hex").slice(0, 12);

const contenido = `self.SW_VERSION = ${JSON.stringify(version)};\n`;
const destino = path.join(__dirname, "..", "public", "sw-version.js");

fs.writeFileSync(destino, contenido, "utf8");
console.log("[prebuild] SW version:", version);
