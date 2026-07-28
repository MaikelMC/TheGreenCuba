import type { Metadata } from "next";
import { DM_Sans, Source_Sans_3, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "sonner";
import "./globals.css";

const fontDisplay = DM_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const fontBody = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "La Verde — Descubre Cuba",
    template: "%s — La Verde",
  },
  description:
    "Descubre los mejores lugares en Cuba con inteligencia artificial. Restaurantes, cafeterías, playas y más.",
  keywords: ["Cuba", "lugares", "recomendaciones", "IA", "turismo"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable} font-body`}
      >
          <ThemeProvider
            attribute="data-theme"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster
              position="bottom-center"
              toastOptions={{
                style: {
                  background: "var(--foreground)",
                  color: "var(--background)",
                  borderRadius: "999px",
                  fontSize: "14px",
                  fontWeight: 600,
                },
              }}
            />
          </ThemeProvider>
      </body>
    </html>
  );
}
