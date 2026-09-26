import type { Metadata } from "next";
import { MotionConfig } from "motion/react";
import {
  Header,
  Hero,
  HowItWorks,
  SearchExamples,
  Features,
  PlaceStrip,
  CTASection,
} from "@/components/landing";
import { Footer } from "@/components/layout/footer";
import { siteConfig } from "@/config/site";
import { listPlaces } from "@/lib/db/queries";
import type { PlaceStripPlace } from "@/components/landing/place-strip";

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

/**
 * Qué es La Verde, dicho en el idioma de las máquinas (AEO).
 *
 * Los sistemas de respuesta —Google incluido— leen esta página mejor cuando la
 * identidad del sitio va declarada además de escrita. Solo se afirma lo que
 * existe: el nombre, la URL, el idioma y el buscador propio del sitio.
 */
const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteConfig.name,
  url: siteConfig.url,
  inLanguage: "es-CU",
  description: siteConfig.description,
};

/* La tira de lugares se resuelve en el servidor: su HTML viaja con la página,
   lo que da a los buscadores enlaces rastreables del home a las fichas y
   da al ancla «#lugares» del menú un destino real. Si Neon no contesta, la
   sección se omite y la landing no se entera. */
async function loadStripPlaces(): Promise<PlaceStripPlace[]> {
  try {
    const places = await listPlaces({ onlyActive: true, limit: 8 });
    return places.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      barrio: p.barrio || "",
      rating: p.rating,
    }));
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(WEBSITE_JSON_LD).replace(/</g, "\\u003c"),
        }}
      />
      <MotionConfig reducedMotion="user">
      <div className="lv-grain flex min-h-screen min-h-dvh flex-col bg-sand font-lv text-ink">
        <Header />

        <main id="content" className="flex-1">
          <Hero />
          <HowItWorks />
          <SearchExamples />
          <Features />
          <PlaceStrip places={await loadStripPlaces()} />
          <CTASection />
        </main>

        <Footer />
      </div>
    </MotionConfig>
    </>
  );
}
