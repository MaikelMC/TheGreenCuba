"use client";

/**
 * Fallback de último recurso: se renderiza cuando falla el propio layout raíz,
 * así que reemplaza a `<html>` y `<body>` y NO puede contar con globals.css ni
 * con las fuentes de next/font. Por eso los estilos van en línea, con la pila
 * de fuentes del sistema, replicando los tokens del diseño a mano.
 *
 * Los valores son los del design system en hex, no en `oklch()`: los tokens
 * viejos —el acento `oklch(62% 0.16 145)`, el gris `oklch(90% 0.004 250)` del
 * borde— son el lenguaje anterior a la unificación, y esta pantalla también
 * tiene que verse como La Verde.
 *
 * Los botones llevan una hoja de estilos propia en vez de manejadores de
 * `mouseenter` en React: un `<style>` da el hover y la transición de 500 ms
 * del sistema sin estado ni re-render.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const verde400 = "#35AF6D";
  const verde300 = "#67C792";
  const verde950 = "#052017";
  const ink = "#08130D";
  const inkSoft = "#1B2A21";
  const sand = "#F6F3EC";
  const red = "#DE3B3D";

  return (
    <html lang="es">
      <head>
        <style>{`
          .ge-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            height: 44px;
            padding: 0 24px;
            border-radius: 999px;
            font-size: 14px;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            transition: background-color 500ms cubic-bezier(0.22, 1, 0.36, 1);
          }
          .ge-primary { background: ${verde400}; color: ${verde950}; border: none;
            box-shadow: 0 18px 40px -12px rgba(53,175,109,0.6); }
          .ge-primary:hover { background: ${verde300}; }
          .ge-outline { background: #FFFFFF; color: ${ink};
            border: 1px solid rgba(8,19,13,0.10); }
          .ge-outline:hover { background: #EAF7EF; border-color: #67C792; }
          @media (prefers-reduced-motion: reduce) { .ge-btn { transition: none; } }
        `}</style>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 20,
          boxSizing: "border-box",
          background: sand,
          color: ink,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 16px",
              display: "grid",
              placeItems: "center",
              borderRadius: 9999,
              background: "rgba(222,59,61,0.10)",
              color: red,
              fontSize: 30,
              lineHeight: 1,
            }}
            aria-hidden
          >
            !
          </div>

          <h1
            style={{
              margin: "0 0 8px",
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            La aplicación no pudo cargar
          </h1>

          <p
            style={{
              margin: "0 0 20px",
              fontSize: 14,
              lineHeight: 1.5,
              color: inkSoft,
              opacity: 0.75,
            }}
          >
            Algo falló al iniciar La Verde. Reintenta o recarga la página.
          </p>

          {error.digest ? (
            <p
              style={{
                margin: "0 0 20px",
                fontSize: 11,
                letterSpacing: "0.04em",
                color: inkSoft,
                opacity: 0.5,
              }}
            >
              Ref: {error.digest}
            </p>
          ) : null}

          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" className="ge-btn ge-primary" onClick={reset}>
              Reintentar
            </button>
            <button
              type="button"
              className="ge-btn ge-outline"
              onClick={() => window.location.reload()}
            >
              Recargar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
