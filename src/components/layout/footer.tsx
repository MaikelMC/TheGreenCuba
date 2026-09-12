import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="border-t border-border py-gap-2xl text-muted-foreground text-[14px]">
      <div className="mx-auto max-w-container px-5 md:px-8">
        <div className="flex flex-wrap justify-between items-start gap-gap-xl">
          <div className="max-w-[280px]">
            <div className="font-display text-[18px] font-bold text-foreground flex items-center gap-gap-xs mb-gap-sm">
              <span className="size-6 rounded-[6px] bg-accent grid place-items-center text-accent-foreground">
                <Logo className="size-4" />
              </span>
              La Verde
            </div>
            <p className="text-[14px] leading-[1.6] text-muted-foreground">
              La plataforma de descubrimiento de lugares en Cuba. Encuentra lo que buscas hablando como hablas.
            </p>
          </div>
          <div className="flex gap-gap-2xl flex-wrap">
            <div>
              <h4 className="font-display text-[14px] font-semibold text-foreground mb-gap-sm">Producto</h4>
              <a href="#como-funciona" className="block text-[14px] text-muted-foreground py-[3px] hover:text-accent">Cómo funciona</a>
              <a href="#ejemplos" className="block text-[14px] text-muted-foreground py-[3px] hover:text-accent">Ejemplos</a>
              <a href="/business" className="block text-[14px] text-muted-foreground py-[3px] hover:text-accent">Para negocios</a>
            </div>
            <div>
              <h4 className="font-display text-[14px] font-semibold text-foreground mb-gap-sm">Legal</h4>
              <a href="#" className="block text-[14px] text-muted-foreground py-[3px] hover:text-accent">Privacidad</a>
              <a href="#" className="block text-[14px] text-muted-foreground py-[3px] hover:text-accent">Términos</a>
            </div>
          </div>
        </div>
        <div className="mt-gap-2xl pt-gap-lg border-t border-border flex flex-wrap justify-between items-center gap-gap-md text-[13px]">
          <span>&copy; 2026 La Verde. Hecho en Cuba.</span>
          <span className="font-mono text-meta text-muted-foreground">Hecho con cariño desde Cuba.</span>
        </div>
      </div>
    </footer>
  );
}
