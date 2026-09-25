"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LoginButton } from "@/components/landing/login-button";
import { Logo } from "@/components/layout/logo";
import { EASE } from "./anim";

const NAV_LINKS = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#ejemplos", label: "Ejemplos" },
  { href: "#lugares", label: "Lugares" },
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
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: visible ? 0 : -100, opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
      className="fixed inset-x-0 top-0 z-50 px-gutter pt-3 md:px-gutter-lg"
    >
      <div className="landing-nav-surface mx-auto flex h-14 max-w-3xl items-center justify-between rounded-full bg-verde-950/70 pl-4 pr-2 ring-1 ring-white/10 backdrop-blur-2xl">
        <Link
          href="/"
          className="flex items-center gap-2 font-lv-display text-[20px] font-bold tracking-[-0.02em] text-white"
        >
          {/* El PNG trae su propio degradado verde: sin círculo detrás. */}
          <Logo className="h-[26px] w-auto shrink-0" />
          La Verde
        </Link>

        <nav className="hidden items-center gap-gap-xl sm:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="landing-nav-link text-[15px] text-white/70 transition-colors duration-500 hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-gap-md">
          <LoginButton className="px-[18px] py-2.5 max-sm:hidden" />

          <Sheet>
            <SheetTrigger asChild>
              <button
                className="grid size-10 place-items-center rounded-full text-white sm:hidden"
                aria-label="Abrir menú"
              >
                <svg
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
                      className="landing-mobile-nav-link text-[17px] font-medium text-foreground transition-colors hover:text-accent"
                    >
                      {link.label}
                    </a>
                  </SheetClose>
                ))}
                <SheetClose asChild>
                  <LoginButton className="mt-gap-sm w-full py-3" />
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.header>
  );
}