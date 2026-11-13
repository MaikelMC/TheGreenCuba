import { readFile } from "node:fs/promises";
import vm from "node:vm";

const ORIGIN = "https://laverde.cu";
const keyOf = (r) => (typeof r === "string" ? new URL(r, ORIGIN).href : r.url);

class FakeCache {
  constructor(nombre) {
    this.nombre = nombre;
    this.map = new Map();
  }
  async match(req) {
    const hit = this.map.get(keyOf(req));
    return hit ? hit.clone() : undefined;
  }
  async put(req, res) {
    const texto = await res.clone().text();
    this.map.set(
      keyOf(req),
      new Response(texto, {
        status: res.status,
        headers: new Headers(res.headers),
      }),
    );
  }
  async add(req) {
    const res = await fetch(req);
    if (!res.ok) throw new Error("add falló");
    await this.put(req, res);
  }
  async delete(req) {
    return this.map.delete(keyOf(req));
  }
  async keys() {
    return [...this.map.keys()].map((url) => new Request(url));
  }
}

const cachesMap = new Map();
const caches = {
  async open(nombre) {
    if (!cachesMap.has(nombre)) cachesMap.set(nombre, new FakeCache(nombre));
    return cachesMap.get(nombre);
  },
  async match(req) {
    for (const cache of cachesMap.values()) {
      const hit = await cache.match(req);
      if (hit) return hit;
    }
    return undefined;
  },
  async keys() {
    return [...cachesMap.keys()];
  },
  async delete(nombre) {
    return cachesMap.delete(nombre);
  },
};

const handlers = {};
const HTML_CATALOGO = "<html><body>CATALOGO LA VERDE</body></html>";
const HTML_OFFLINE = "<html><body>OFFLINE</body></html>";
let online = true;

async function fetchSimulado(input) {
  const url = typeof input === "string" ? new URL(input, ORIGIN) : new URL(input.url);

  if (!online) throw new TypeError("Failed to fetch");

  if (url.pathname === "/servicios") {
    return new Response(HTML_CATALOGO, {
      status: 200,
      headers: {
        "Content-Type": "text/html",
        /* Así marca Next las páginas dinámicas: el caso que hay que ignorar. */
        "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
      },
    });
  }
  if (url.pathname === "/servicios/carta-y-qr") {
    return new Response("<html>FICHA</html>", {
      status: 200,
      headers: { "Content-Type": "text/html", "Cache-Control": "no-store" },
    });
  }
  if (url.pathname === "/offline.html") {
    return new Response(HTML_OFFLINE, { status: 200, headers: { "Content-Type": "text/html" } });
  }
  if (url.pathname === "/home") {
    return new Response("<html>HOME</html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }
  if (url.hostname === "tiles.openfreemap.org") {
    return new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response("recurso", { status: 200, headers: { "Content-Type": "text/plain" } });
}

const self = {
  location: { origin: ORIGIN },
  navigator: { onLine: true },
  addEventListener: (tipo, fn) => {
    handlers[tipo] = fn;
  },
  clients: {
    matchAll: async () => [],
    claim: async () => {},
  },
  skipWaiting: () => {},
};

/* En un service worker real `new Request("/x")` se resuelve contra la URL del
   SW; el Request de Node exige absoluta. */
class RequestAbs extends Request {
  constructor(input, init) {
    super(typeof input === "string" ? new URL(input, ORIGIN).href : input, init);
  }
}



function navegar(url) {
  const real = new RequestAbs(url);
  return new Proxy(real, {
    get(target, prop) {
      if (prop === "mode") return "navigate";
      const v = target[prop];
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
}

const sandbox = {
  self,
  caches,
  fetch: fetchSimulado,
  Request: RequestAbs,
  Response,
  Headers,
  URL,
  console,
  setTimeout,
  clearTimeout,
  importScripts: () => {
    throw new Error("sin sw-version.js en el arnés");
  },
};
vm.createContext(sandbox);
const codigo = await readFile("public/sw.js", "utf8");
vm.runInContext(codigo, sandbox, { filename: "sw.js" });

function evento(extra = {}) {
  let promesa = null;
  return {
    request: extra.request,
    waitUntil: (p) => {
      promesa = promesa ? Promise.all([promesa, p]) : p;
    },
    respondWith: (p) => {
      promesa = p;
    },
    result: () => promesa,
  };
}

/* 1. Instalación con red: el catálogo debe quedar guardado pese al no-store. */
const install = evento();
handlers.install(install);
await install.result();
const catalogoCache = await caches.open("lv-catalogo-lv-v9");
const guardado = await catalogoCache.match("/servicios");
console.log("instalación guarda /servicios:", guardado ? "SÍ" : "NO");
console.log("home en páginas:", (await (await caches.open("lv-pages-lv-v9")).match("/home")) ? "SÍ" : "NO");

/* 2. Sin red, abrir /servicios en frío. */
online = false;
self.navigator.onLine = false;
const nav = evento({
  request: navegar(`${ORIGIN}/servicios`),
});
handlers.fetch(nav);
const respuesta = await nav.result();
console.log("offline /servicios:", respuesta.status, (await respuesta.text()).includes("CATALOGO"));

/* 3. Sin red, abrir una ficha que nunca se visitó: debe caer al índice. */
const ficha = evento({
  request: navegar(`${ORIGIN}/servicios/pedidos-programados`),
});
handlers.fetch(ficha);
const rFicha = await ficha.result();
console.log(
  "offline ficha sin copia:",
  rFicha.status,
  (await rFicha.text()).includes("CATALOGO") ? "cae al índice" : "NO cae al índice",
);

/* 4. La navegación normal no debe quedarse con el catálogo. */
const home = evento({
  request: navegar(`${ORIGIN}/home`),
});
handlers.fetch(home);
const rHome = await home.result();
console.log("offline /home:", rHome.status, (await rHome.text()).includes("HOME"));
