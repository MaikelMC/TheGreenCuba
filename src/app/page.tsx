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

export default function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      {/* Las variables de las fuentes viven en `<body>` (src/lib/fonts.ts), así
          que las hereda también el diálogo, que se monta en un portal fuera de
          este árbol. */}
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

      <WaitlistDialog />
    </MotionConfig>
  );
}
