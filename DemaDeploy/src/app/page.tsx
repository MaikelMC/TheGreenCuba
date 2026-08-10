import Navigation from "@/components/navigation";
import Hero from "@/components/hero";
import MapDemo from "@/components/map-demo";
import AiDemo from "@/components/ai-demo";
import HowItWorks from "@/components/how-it-works";
import WhyDifferent from "@/components/why-different";
import Waitlist from "@/components/waitlist";
import Footer from "@/components/footer";

export default function HomePage() {
  return (
    <>
      <Navigation />
      <main>
        <Hero />
        <MapDemo />
        <AiDemo />
        <HowItWorks />
        <WhyDifferent />
        <Waitlist />
      </main>
      <Footer />
    </>
  );
}