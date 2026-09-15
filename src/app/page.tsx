import { Space_Grotesk, Plus_Jakarta_Sans } from "next/font/google";
import { MotionConfig } from "motion/react";
import {
  Header,
  Hero,
  HowItWorks,
  SearchExamples,
  Features,
  CTASection,
} from "@/components/landing";
import { WaitlistDialog } from "@/components/landing/waitlist-dialog-lazy";
import { Footer } from "@/components/layout/footer";

/**
 * Tipografías del design system de La Verde. Se cargan aquí, en el Server
 * Component de la ruta, y no en el layout raíz: el layout raíz sirve también a
 * la app (`/home`, `/admin`), que sigue con DM Sans y Source Sans 3. Las
 * variables las consume `font-lv` / `font-lv-display` de tailwind.config.ts.
 */
const lvSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-lv-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const lvDisplay = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-lv-display",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      {/* El div envuelve también al diálogo: se monta en un portal fuera del
          flujo, así que sin esto no heredaría las variables de las fuentes. */}
      <div className={`${lvSans.variable} ${lvDisplay.variable}`}>
        <div className="lv-grain flex min-h-screen min-h-dvh flex-col bg-sand font-lv text-ink">
          <Header />

          <main id="content" className="flex-1">
            <Hero />
            <HowItWorks />
            <SearchExamples />
            <Features />
            <CTASection />
          </main>

          <Footer />
        </div>

        {/* El diálogo se monta en un portal bajo `<body>`, fuera de este div,
            así que hay que volver a pasarle las variables de las fuentes: si
            no, saldría con las tipografías de la app. */}
        <WaitlistDialog className={`${lvSans.variable} ${lvDisplay.variable}`} />
      </div>
    </MotionConfig>
  );
}
