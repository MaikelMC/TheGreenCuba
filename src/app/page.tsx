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
