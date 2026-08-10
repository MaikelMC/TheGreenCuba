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
      <div className="flex min-h-screen flex-col">
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