"use client";

import { createContext, useContext, type ReactNode } from "react";
import { CATALOGO, type Catalogo } from "@/lib/plans";

/**
 * El catálogo de planes, ya resuelto en el servidor, al alcance del navegador.
 *
 * Existe porque los precios, los nombres y los textos ya **no son constantes**:
 * administración los cambia desde `/admin/planes` y el panel del negocio tiene
 * que enseñar lo de hoy, no lo que decía el código cuando se desplegó. Antes
 * bastaba con importar `FUNCIONES` o `PACKS`; ahora eso daría la versión de
 * fábrica, que es exactamente lo que hay que dejar de usar en los componentes.
 *
 * El servidor lo lee una vez por árbol —el layout de `/admin`, la página de
 * `/business`— y lo pasa como prop. **Sin provider devuelve `CATALOGO`**, para
 * que un componente reutilizado fuera de esos dos árboles no reviente: se vería
 * con los valores de fábrica, que es mejor que no verse.
 *
 * No es un `fetch`: el catálogo no cambia mientras alguien mira la pantalla, y
 * una segunda petición solo añadiría el parpadeo de «cargando precios». Un
 * `router.refresh()` tras guardarlo trae el nuevo.
 */

const CatalogoContext = createContext<Catalogo | null>(null);

export function CatalogoProvider({
  catalogo,
  children,
}: {
  /** El catálogo vigente. Sin él se usa el de fábrica. */
  catalogo?: Catalogo;
  children: ReactNode;
}) {
  return (
    <CatalogoContext.Provider value={catalogo ?? CATALOGO}>
      {children}
    </CatalogoContext.Provider>
  );
}

/** El catálogo vigente. Nunca es `null`: fuera de un provider es el de fábrica. */
export function useCatalogo(): Catalogo {
  return useContext(CatalogoContext) ?? CATALOGO;
}
