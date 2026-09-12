"use client";

/**
 * Fallback de último recurso: se renderiza cuando falla el propio layout raíz,
 * así que reemplaza a `<html>` y `<body>` y NO puede contar con globals.css ni
 * con las fuentes de next/font. Por eso los estilos van inline y con la pila de
 * fuentes del sistema, replicando los tokens del diseño a mano.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const accent = "oklch(62% 0.16 145)";
  const foreground = "oklch(18% 0.01 250)";
  const muted = "oklch(52% 0.01 250)";

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 20,
          boxSizing: "border-box",
          background: "oklch(98% 0.005 85)",
          color: foreground,
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
              background: "oklch(60% 0.20 25 / 0.08)",
              color: "oklch(60% 0.20 25)",
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
              letterSpacing: "-0.01em",
            }}
          >
            La aplicación no pudo cargar
          </h1>

          <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.5, color: muted }}>
            Algo falló al iniciar La Verde. Reintenta o recarga la página.
          </p>

          {error.digest ? (
            <p
              style={{
                margin: "0 0 20px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 11,
                color: muted,
                opacity: 0.7,
              }}
            >
              Ref: {error.digest}
            </p>
          ) : null}

          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: "10px 20px",
                border: "none",
                borderRadius: 10,
                background: accent,
                color: "white",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 20px",
                border: "1px solid oklch(90% 0.004 250)",
                borderRadius: 10,
                background: "white",
                color: foreground,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Recargar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
