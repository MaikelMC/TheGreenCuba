/**
 * Prebuild: escribe public/sw-version.js con la versión del build.
 *
 * La versión es la fecha y hora del build (ISO compacto). No depende de git
 * ni del BUILD_ID de Next —que aún no existe cuando corre el prebuild— así
 * que funciona igual en local, CI y el Dockerfile del VPS.
 *
 * El service worker importa este archivo con importScripts('/sw-version.js')
 * y lo usa como CACHE_VERSION. El navegador detecta el cambio porque rastrea
 * los scripts importados: si sw-version.js cambia, instala un SW nuevo.
 *
 * sw-version.js va en .gitignore: se genera en cada build y nunca se
 * compromete al repositorio.
 */

const fs = require("fs");
const path = require("path");

const version =
  "lv-" +
  new Date()
    .toISOString()
    .replace(/[T:.Z]/g, "-")
    .replace(/-+$/, "")
    .slice(0, 19)
    .replace("T", "-");

const contenido = `self.SW_VERSION = ${JSON.stringify(version)};\n`;
const destino = path.join(__dirname, "..", "public", "sw-version.js");

fs.writeFileSync(destino, contenido, "utf8");
console.log("[prebuild] SW version:", version);
