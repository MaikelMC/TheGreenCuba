import type { Catalogo } from "@/lib/plans";
import { textoCup } from "@/lib/plans";
import type { PrecioPieza } from "@/content/servicios";

interface Props {
  precio: PrecioPieza;
  catalogo: Catalogo;
}

export function PrecioServicio({ precio, catalogo }: Props) {
  if (precio.tipo === "incluido") {
    const modulo = catalogo.modulos[precio.en];
    return (
      <p className="text-sm text-muted-foreground">
        Incluido en{" "}
        <span className="font-medium text-foreground">{modulo.nombre}</span>
        {" · "}
        <span className="font-medium text-foreground">
          ${modulo.usd} / {textoCup(modulo.usd, catalogo)}
        </span>
      </p>
    );
  }

  const modulo = catalogo.modulos[precio.clave];
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-3xl font-bold text-foreground">${modulo.usd}</span>
      <span className="text-muted-foreground">
        · {textoCup(modulo.usd, catalogo)} al mes
      </span>
    </div>
  );
}
