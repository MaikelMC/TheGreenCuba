import type { ReactNode } from "react";
import { Header } from "@/components/landing/header";

export default function ServiciosLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <div className="pt-[var(--header-h)]">{children}</div>
    </>
  );
}
