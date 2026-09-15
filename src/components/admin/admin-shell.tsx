"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  LayoutDashboard,
  Store,
  Tags,
  Bot,
  ArrowLeft,
  LogOut,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearAdminAuthed } from "@/lib/admin-auth";
import { EASE } from "@/lib/motion";

interface AdminNavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

const NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/negocios", label: "Negocios", icon: Store },
  { href: "/admin/lista-de-espera", label: "Lista de espera", icon: ListTodo },
  { href: "/admin/categorias", label: "Categorías", icon: Tags },
  { href: "/admin/proveedores-ia", label: "Proveedores IA", icon: Bot },
];

function isActiveItem(pathname: string, item: AdminNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    clearAdminAuthed();
    router.push("/home");
  };

  return (
    <div className="h-dvh bg-background flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur border-b border-border h-header flex items-center px-gutter gap-gap-sm shrink-0">
        <Link
          href="/home"
          className="size-8 grid place-items-center rounded-lg hover:bg-accent/10 transition-colors text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Volver al inicio"
        >
          <ArrowLeft size={18} strokeWidth={1.5} />
        </Link>
        <div className="font-display font-bold text-[18px] text-accent tracking-[-0.02em] whitespace-nowrap">
          La Verde <span className="text-foreground font-medium">Admin</span>
        </div>
        <div className="flex-1 min-w-0" />
        <span className="font-mono text-xs font-medium bg-accent/10 text-accent px-[8px] py-[2px] rounded-full border border-accent/20 whitespace-nowrap">
          Panel de administración
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="size-9 rounded-full border border-border grid place-items-center text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition-colors"
          aria-label="Cerrar sesión de administrador"
        >
          <LogOut size={16} strokeWidth={2} />
        </button>
      </header>

      {/* Shell */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-[260px] bg-surface border-r border-border shrink-0 px-gap-md pt-gap-md gap-[2px]">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveItem(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-gap-sm w-full px-gap-md py-gap-sm rounded-lv text-small font-medium transition-colors duration-fast text-left border-none bg-transparent cursor-pointer font-body",
                  isActive ? "text-accent font-semibold" : "text-foreground hover:bg-muted",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="admin-nav-side"
                    className="absolute inset-0 rounded-lv bg-accent/10"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon size={20} strokeWidth={1.5} className="relative shrink-0 z-10" />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-gap-md pb-[80px] lg:pb-gap-xl lg:p-gap-xl flex flex-col min-h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="flex flex-col min-h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Bottom Nav (mobile) */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-border h-16 pb-safe-bottom flex lg:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = isActiveItem(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-[2px] text-xs font-medium transition-colors duration-fast font-body",
                isActive ? "text-accent" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="admin-nav-bottom"
                  className="absolute top-0 h-[2px] w-8 rounded-full bg-accent"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon size={22} strokeWidth={1.5} className="relative z-10" />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
