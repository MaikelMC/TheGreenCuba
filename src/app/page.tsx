import { MotionConfig } from "framer-motion";
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
    </MotionConfig>
  );
}