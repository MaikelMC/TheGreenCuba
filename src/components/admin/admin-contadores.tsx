"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { ContadoresAdmin } from "@/lib/admin-contadores";

/**
 * Los contadores de la navegación, vivos.
 *
 * El primer valor llega del layout del servidor —la misma petición que ya
 * consulta la base para el rol—, así que la barra lateral se pinta con números
 * desde el primer byte y sin una petición extra al montar.
 *
 * Se refresca al volver a la pestaña (`visibilitychange`), al recuperar el foco
 * y cuando una acción del panel avisa con `avisarCambioAdmin()`. No hay sondeo
 * periódico: dos administradores y diez consultas de `count(*)` cada minuto no
 * compensan, y los números se ponen al día en cuanto alguien mira.
 */
const EVENTO_ACTUALIZAR = "lv:admin-contadores";

interface ContextoContadores {
  contadores: ContadoresAdmin;
  refrescar: () => Promise<void>;
}

const Contexto = createContext<ContextoContadores | null>(null);

export function AdminContadoresProvider({
  inicial,
  children,
}: {
  inicial: ContadoresAdmin;
  children: ReactNode;
}) {
  const [contadores, setContadores] = useState(inicial);
  const pathname = usePathname();

  const refrescar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/contadores", { cache: "no-store" });
      if (!res.ok) return;
      const datos = (await res.json()) as ContadoresAdmin;
      setContadores(datos);
    } catch {
      /* Sin conexión o base caída: se conservan los últimos números. La barra
         no puede quedarse en blanco por un contador. */
    }
  }, []);

  /* Cada navegación dentro del panel puede cambiar lo que hay pendiente. */
  useEffect(() => {
    void refrescar();
  }, [pathname, refrescar]);

  /* Los contadores se refrescan **después de cada acción del panel**, sin que
     cada pantalla tenga que acordarse de avisar. En lugar de tocar los quince
     componentes que llaman a `fetch`, se envuelve una vez el `fetch` del panel:
     si una petición muta datos y sale bien, se pide el recuento nuevo. Las
     lecturas (`GET`) y las peticiones fallidas no disparan nada. */
  useEffect(() => {
    const original = window.fetch.bind(window);

    const envuelto = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const respuesta = await original(input, init);
      const metodo = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();

      if (respuesta.ok && metodo !== "GET" && metodo !== "HEAD") {
        window.dispatchEvent(new Event(EVENTO_ACTUALIZAR));
      }
      return respuesta;
    };

    window.fetch = envuelto as typeof window.fetch;
    return () => {
      window.fetch = original;
    };
  }, []);

  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === "visible") void refrescar();
    };
    const alEnfocar = () => void refrescar();
    const alAvisar = () => void refrescar();

    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alEnfocar);
    window.addEventListener(EVENTO_ACTUALIZAR, alAvisar);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alEnfocar);
      window.removeEventListener(EVENTO_ACTUALIZAR, alAvisar);
    };
  }, [refrescar]);

  const valor = useMemo(
    () => ({ contadores, refrescar }),
    [contadores, refrescar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAdminContadores(): ContextoContadores {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error("useAdminContadores necesita AdminContadoresProvider");
  }
  return contexto;
}

/**
 * Avisa de que una acción cambió datos. La llama el componente que ya sabe que
 * el `PATCH` salió bien; los contadores se recalculan sin recargar la pantalla.
 */
export function avisarCambioAdmin(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENTO_ACTUALIZAR));
  }
}
