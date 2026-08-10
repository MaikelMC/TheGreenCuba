import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "La Verde · El lugar que necesitas, cerca de ti";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 96px",
          background: "linear-gradient(135deg,#06211A,#081B12)",
          fontFamily: "sans-serif",
          color: "#EAF7EF"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              background: "linear-gradient(135deg,#35AF6D,#0F7A41)",
              display: "flex"
            }}
          />
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
            La Verde
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -2
          }}
        >
          Te damos
          <br />
          <span style={{ color: "#35AF6D" }}>la verde.</span>
        </div>
        <div style={{ marginTop: 32, fontSize: 30, opacity: 0.75 }}>
          El lugar correcto, cerca de ti · para compartir, visitar y comprar.
        </div>
      </div>
    ),
    size
  );
}