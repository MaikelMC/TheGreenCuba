import type { Metadata } from "next";

/**
 * Fuera del índice: el flujo de restablecimiento es transitorio y personal.
 * No aporta nada a un buscador y no debe competir con la portada.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
