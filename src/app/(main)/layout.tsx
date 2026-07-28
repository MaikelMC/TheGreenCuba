import { type ReactNode } from "react";
import { Header } from "@/components/layout/header";
import { SearchProvider } from "@/providers/search-provider";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <SearchProvider>
      <Header />
      <main className="pt-[var(--header-h)] min-h-screen">{children}</main>
    </SearchProvider>
  );
}
