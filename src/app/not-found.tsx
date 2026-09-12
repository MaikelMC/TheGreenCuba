import type { Metadata } from "next";
import Link from "next/link";
import { Compass, MapPinOff } from "lucide-react";
import { Button, StateView } from "@/components/ui";

export const metadata: Metadata = {
  title: "Página no encontrada",
};

export default function NotFound() {
  return (
    <div className="grid min-h-screen min-h-dvh place-items-center bg-background px-gutter">
      <StateView
        icon={MapPinOff}
        title="No encontramos esta página"
        description="Puede que el enlace esté roto o que el lugar ya no exista. Vuelve al inicio para seguir explorando."
        actions={
          <>
            <Button asChild className="gap-[6px]">
              <Link href="/home">
                <Compass size={16} strokeWidth={2} />
                Explorar lugares
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Ir a la portada</Link>
            </Button>
          </>
        }
      />
    </div>
  );
}
