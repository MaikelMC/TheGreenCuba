"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Leaf, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { easeSpring } from "@/lib/motion";

const LINKS = [
  { href: "#mapa", label: "El Mapa" },
  { href: "#busqueda", label: "Búsqueda" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#diferente", label: "Por qué La Verde" }
];

export default function Navigation() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Bloquea scroll del fondo cuando el overlay está abierto
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    setTimeout(() => {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
    }, open ? 120 : 0);
  };

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: easeSpring, delay: 0.2 }}
      >
        <nav
          className={cn(
            "flex w-full max-w-3xl items-center justify-between rounded-full py-2 pl-4 pr-2 transition-all duration-500",
            scrolled
              ? "bg-verde-950/80 text-white backdrop-blur-xl ring-1 ring-white/10 shadow-card"
              : "bg-verde-950/40 text-white ring-1 ring-white/10 backdrop-blur-md"
          )}
          style={{ transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
        >
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="group flex items-center gap-2"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-verde-400 to-verde-600 shadow-soft transition-transform duration-500 group-hover:rotate-[8deg]">
              <Leaf className="h-4.5 w-4.5 text-verde-950" strokeWidth={2.2} />
            </span>
            <span className="font-display text-sm font-bold tracking-tight">
              La Verde
            </span>
          </a>

          <div className="flex items-center gap-1">
            <button
              onClick={() => go("#waitlist")}
              className="hidden rounded-full px-4 py-2 text-xs font-semibold text-white/80 transition-colors duration-300 hover:text-white sm:block"
            >
              Únete
            </button>
            <button
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              onClick={() => setOpen((o) => !o)}
              className="relative grid h-10 w-10 place-items-center rounded-full bg-white/10 transition-colors duration-300 hover:bg-white/20"
            >
              <motion.span
                className="absolute h-0.5 w-4 rounded-full bg-white"
                animate={reduce ? undefined : open ? { rotate: 45, y: 0 } : { rotate: 0, y: -3.5 }}
                transition={{ duration: 0.35, ease: easeSpring }}
              />
              <motion.span
                className="absolute h-0.5 w-4 rounded-full bg-white"
                animate={reduce ? undefined : open ? { rotate: -45, y: 0 } : { rotate: 0, y: 3.5 }}
                transition={{ duration: 0.35, ease: easeSpring }}
              />
              <span className="sr-only">{open ? "Cerrar" : "Abrir"}</span>
            </button>
          </div>
        </nav>
      </motion.header>

      {/* Overlay glass a pantalla completa */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-verde-950/85 backdrop-blur-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: easeSpring }}
          >
            <nav className="flex flex-col items-center gap-2 px-6 text-center">
              {LINKS.map((link, i) => (
                <motion.button
                  key={link.href}
                  onClick={() => go(link.href)}
                  className="group relative py-2"
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.15 + i * 0.08, duration: 0.5 }}
                >
                  <span className="font-display text-3xl font-bold tracking-tight text-white/90 transition-colors duration-300 group-hover:text-verde-300 sm:text-4xl">
                    {link.label}
                  </span>
                </motion.button>
              ))}
              <motion.div
                className="mt-8"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.45, duration: 0.5 }}
              >
                <button
                  onClick={() => go("#waitlist")}
                  className="rounded-full bg-verde-400 px-7 py-3 text-sm font-bold text-verde-950 shadow-soft transition-transform duration-300 active:scale-[0.98]"
                >
                  Reservar mi cupo
                </button>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}