import Link from "next/link";
import { Hero, HowItWorks, SearchExamples, Features, CTASection } from "@/components/landing";
import { Footer } from "@/components/layout/footer";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-background/92 backdrop-blur-[16px]">
        <div className="mx-auto flex h-14 max-w-container items-center justify-between px-gutter md:h-auto md:px-gutter-lg md:py-3.5">
          <Link href="/" className="flex items-center gap-2 font-display text-[20px] font-bold tracking-[-0.02em] text-foreground">
            <span className="grid size-7 place-items-center rounded-[8px] bg-accent text-[14px] text-accent-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 3c-4.97 0-9 3.58-9 8s4.03 8 9 8c.71 0 1.4-.08 2.06-.22L19 21l-.78-3.46C20.04 16.21 21 14.21 21 12c0-4.42-4.03-8-9-8z" />
              </svg>
            </span>
            La Verde
          </Link>
          <nav className="hidden items-center gap-gap-xl sm:flex">
            <a href="#como-funciona" className="text-[15px] text-muted-foreground transition-colors hover:text-foreground">
              Como funciona
            </a>
            <a href="#ejemplos" className="text-[15px] text-muted-foreground transition-colors hover:text-foreground">
              Ejemplos
            </a>
            <a href="#lugares" className="text-[15px] text-muted-foreground transition-colors hover:text-foreground">
              Lugares
            </a>
          </nav>
          <div className="flex items-center gap-gap-md">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lv bg-accent px-[18px] py-2.5 font-display text-[14px] font-semibold leading-none text-accent-foreground shadow-[0_1px_3px_oklch(62%_0.16_145/0.25)] transition-all duration-200 active:translate-y-px hover:bg-accent-hover hover:shadow-[0_4px_12px_oklch(62%_0.16_145/0.3)] max-sm:hidden"
            >
              Unirse a la lista
            </Link>
            <button className="grid size-10 place-items-center rounded-full sm:hidden" aria-label="Menu">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main id="content" className="flex-1">
        <Hero />
        <HowItWorks />
        <SearchExamples />
        <Features />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
