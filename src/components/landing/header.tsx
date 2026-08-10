"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { JoinButton } from "@/components/landing/join-button";

const NAV_LINKS = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#ejemplos", label: "Ejemplos" },
  { href: "#lugares", label: "Lugares" },
];

export function Header() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-50 border-b border-border bg-background/92 backdrop-blur-[16px]"
    >
      <div className="mx-auto flex h-14 max-w-container items-center justify-between px-gutter md:px-gutter-lg">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-[20px] font-bold tracking-[-0.02em] text-foreground"
        >
          <span className="grid size-7 place-items-center rounded-[8px] bg-accent text-[14px] text-accent-foreground">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M12 3c-4.97 0-9 3.58-9 8s4.03 8 9 8c.71 0 1.4-.08 2.06-.22L19 21l-.78-3.46C20.04 16.21 21 14.21 21 12c0-4.42-4.03-8-9-8z" />
            </svg>
          </span>
          La Verde
        </Link>

        <nav className="hidden items-center gap-gap-xl sm:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[15px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-gap-md">
          <JoinButton className="px-[18px] py-2.5 text-[14px] max-sm:hidden" />

          <Sheet>
            <SheetTrigger asChild>
              <button
                className="grid size-10 place-items-center rounded-full sm:hidden"
                aria-label="Abrir menu"
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
                      className="text-[17px] font-medium text-foreground transition-colors hover:text-accent"
                    >
                      {link.label}
                    </a>
                  </SheetClose>
                ))}
                <SheetClose asChild>
                  <JoinButton className="mt-gap-sm w-full py-3 text-[15px]" />
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.header>
  );
}