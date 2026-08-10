import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap"
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "La Verde · Descubre los mejores lugares de Cuba",
    template: "%s · La Verde"
  },
  description:
    "La Verde geolocaliza y cuida los mejores lugares de Cuba: restaurantes, playas, bares y rincones. Pregúntale a La Verde, tu mapa con salud verde.",
  keywords: [
    "La Verde",
    "lugares de Cuba",
    "mapa Cuba",
    "restaurantes La Habana",
    "playas Cuba",
    "guía Cuba"
  ],
  authors: [{ name: "La Verde" }],
  openGraph: {
    type: "website",
    locale: "es",
    url: SITE_URL,
    siteName: "La Verde",
    title: "La Verde · Tu mapa verde de Cuba",
    description:
      "Geolocaliza y cuida los mejores lugares de Cuba. Pregunta a La Verde y explora el mapa con salud verde."
  },
  twitter: {
    card: "summary_large_image",
    title: "La Verde · Tu mapa verde de Cuba",
    description: "Descubre los mejores lugares de Cuba con salud verde."
  },
  robots: {
    index: true,
    follow: true
  }
};

export const viewport: Viewport = {
  themeColor: "#06211a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={cn(plusJakarta.variable, spaceGrotesk.variable)}>
      <body className="grain min-h-[100dvh] font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}