"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#como-funciona", label: "Funciones" },
  { href: "#lugares", label: "Lugares" },
  { href: "#planes", label: "Planes" },
];

export function Header() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let previousY = window.scrollY;

    function handleScroll() {
      const currentY = window.scrollY;
      if (currentY <= 24 || currentY < previousY) {
        setVisible(true);
      } else if (currentY > previousY) {
        setVisible(false);
      }
      previousY = currentY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      onFocusCapture={() => setVisible(true)}
      className={cn(
        "fixed inset-x-0 top-0 z-50 px-gutter pt-[calc(0.75rem+env(safe-area-inset-top))] transition-transform duration-300 ease-outquint md:px-gutter-lg",
        visible ? "translate-y-0" : "-translate-y-[140%]",
      )}
    >
      <div className="landing-nav-surface mx-auto flex h-14 max-w-3xl items-center justify-between rounded-full border border-ink/10 bg-white/85 pl-4 pr-2 shadow-soft backdrop-blur-xl">
        <Link
          href="/"
          className="flex items-center gap-2 font-lv-display text-[20px] font-bold tracking-[-0.02em] text-ink"
        >
          <Logo className="h-[26px] w-auto shrink-0" />
          <span translate="no">La Verde</span>
        </Link>

        <nav className="hidden items-center gap-gap-xl sm:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="landing-nav-link text-[15px] text-ink-soft/70 transition-colors duration-300 hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-gap-md">
          <ThemeToggle className="size-11 border-ink/10 bg-white text-ink shadow-none hover:bg-verde-50" />

          <Link
            href="/login"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-ink/15 px-[18px] py-2.5 font-lv-display text-sm font-semibold leading-none text-ink transition duration-300 ease-outquint hover:border-ink/30 hover:bg-white active:scale-[0.98] max-sm:hidden"
          >
            Iniciar sesión
          </Link>

          <Sheet>
            <SheetTrigger asChild>
              <button
                className="grid size-11 place-items-center rounded-full text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-500/70 sm:hidden"
                aria-label="Abrir menú"
              >
                <svg
                  aria-hidden
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] p-6 sm:hidden">
              <SheetHeader className="text-left">
                <SheetTitle>La Verde</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-gap-md">
                {NAV_LINKS.map((link) => (
                  <SheetClose key={link.href} asChild>
                    <a
                      href={link.href}
                      className="landing-mobile-nav-link flex min-h-11 items-center text-[17px] font-medium text-foreground transition-colors hover:text-accent"
                    >
                      {link.label}
                    </a>
                  </SheetClose>
                ))}
                <SheetClose asChild>
                  <Link
                    href="/login"
                    className="mt-gap-sm inline-flex w-full items-center justify-center rounded-full bg-ink py-3 font-lv-display text-sm font-semibold text-white"
                  >
                    Iniciar sesión
                  </Link>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
