import type { Metadata } from "next";
import { MotionConfig } from "motion/react";
import {
  Header,
  Hero,
  HowItWorks,
  SearchExamples,
  Features,
  CTASection,
} from "@/components/landing";
import { Footer } from "@/components/layout/footer";

/**
 * El canonical va aquí y no en el layout raíz.
 *
 * Puesto en el layout se heredaría en **todas** las páginas, y una ficha que no
 * declare el suyo le estaría diciendo a Google «la buena es la portada», que es
 * la forma más silenciosa de sacar del índice justo las páginas que interesan.
 * Cada ruta de valor declara el suyo; esta es la portada y le toca «/».
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
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
    </MotionConfig>
  );
}
