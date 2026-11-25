"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  UserRound,
} from "lucide-react";
import type {
  AdminSoporte,
  ConversacionSoporte,
} from "@/lib/admin-soporte";
import { BotonAdmin } from "@/components/admin/ui/botones";
import { ChapitaEstado } from "@/components/admin/ui/chapita";
import { EstadoVacioAdmin } from "@/components/admin/ui/tarjeta";
import { FECHA, iniciales } from "./comun";

const SELECT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-3 font-lv-display text-small text-ink outline-none transition-colors duration-300 focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

export function ContextoSoporte({
  conversacion,
  admins,
  yo,
  onAsignar,
  onAbrirFicha,
  onAprobar,
}: {
  conversacion: ConversacionSoporte | null;
  admins: AdminSoporte[];
  yo: AdminSoporte | null;
  onAsignar: (adminId: string | null) => Promise<void>;
  onAbrirFicha: (negocioId: string) => void;
  onAprobar: (negocioId: string) => Promise<boolean>;
}) {
  const [asignando, setAsignando] = useState(false);
  const [confirmarAprobacion, setConfirmarAprobacion] = useState(false);
  const [aprobando, setAprobando] = useState(false);

  useEffect(() => {
    setConfirmarAprobacion(false);
    setAprobando(false);
  }, [conversacion?.id]);

  if (!conversacion) {
    return (
      <div className="rounded-2xl border border-ink/5 bg-white">
        <EstadoVacioAdmin
          icono={Building2}
          titulo="Elige una conversación"
          descripcion="Aquí verás el negocio de la persona y podrás actuar sobre su ficha."
        />
      </div>
    );
  }

  const negocio = conversacion.negocio;
  const otrosAdmins = admins.filter((admin) => admin.id !== yo?.id);
  const asignadoConocido =
    !conversacion.assignedAdminId ||
    conversacion.assignedAdminId === yo?.id ||
    otrosAdmins.some((admin) => admin.id === conversacion.assignedAdminId);

  async function cambiarAsignacion(valor: string) {
    if (asignando) return;
    setAsignando(true);
    try {
      await onAsignar(valor || null);
    } finally {
      setAsignando(false);
    }
  }

  async function aprobar() {
    if (!negocio || aprobando) return;
    if (!confirmarAprobacion) {
      setConfirmarAprobacion(true);
      return;
    }
    setAprobando(true);
    try {
      const aprobada = await onAprobar(negocio.id);
      if (aprobada) setConfirmarAprobacion(false);
    } finally {
      setAprobando(false);
    }
  }

  return (
    <div className="flex flex-col gap-gap-sm">
      <section className="rounded-2xl border border-ink/5 bg-white p-gap-md">
        <div className="flex items-center gap-gap-sm">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-verde-50 font-lv-display text-small font-bold text-verde-700">
            {iniciales(
              conversacion.userSnapshot?.name ||
                conversacion.userSnapshot?.email ||
                conversacion.email,
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-lv-display text-small font-semibold text-ink">
              {conversacion.userSnapshot?.name || "Usuario"}
            </p>
            <p className="truncate text-meta text-ink-soft/75">
              {conversacion.email}
            </p>
          </div>
        </div>

        <div className="mt-gap-sm border-t border-ink/5 pt-gap-sm">
          <label
            htmlFor="asignacion-soporte"
            className="mb-[6px] block font-lv-display text-meta font-semibold text-ink"
          >
            Asignación
          </label>
          <select
            id="asignacion-soporte"
            value={conversacion.assignedAdminId ?? ""}
            onChange={(evento) => void cambiarAsignacion(evento.target.value)}
            disabled={asignando}
            className={SELECT}
          >
            <option value="">Sin asignar</option>
            {yo && <option value={yo.id}>Mía ({yo.nombre})</option>}
            {otrosAdmins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.nombre}
              </option>
            ))}
            {!asignadoConocido && conversacion.assignedAdminId && (
              <option value={conversacion.assignedAdminId}>
                {conversacion.assignedAdminName || "Administrador"}
              </option>
            )}
          </select>
        </div>
      </section>

      <section className="rounded-2xl border border-ink/5 bg-white p-gap-md">
        <div className="flex items-center gap-gap-xs">
          <Building2 size={16} strokeWidth={1.8} className="text-verde-600" />
          <h2 className="font-lv-display text-small font-semibold text-ink">
            Negocio
          </h2>
        </div>

        {negocio ? (
          <>
            <div className="mt-gap-sm flex items-start justify-between gap-gap-sm">
              <div className="min-w-0">
                <p className="font-lv-display text-small font-semibold text-ink">
                  {negocio.nombre}
                </p>
                <p className="mt-[2px] text-meta text-ink-soft/75">
                  {negocio.ciudad}, {negocio.provincia} · {negocio.tipo}
                </p>
              </div>
              <ChapitaEstado tono={negocio.tono}>{negocio.estado}</ChapitaEstado>
            </div>

            <div className="mt-gap-sm flex flex-wrap items-center gap-gap-xs">
              <span className="rounded-full bg-sand px-2 py-[3px] font-lv-display text-meta font-semibold text-ink-soft/80">
                Plan {negocio.plan}
              </span>

            </div>

            <p className="mt-gap-sm text-small text-ink-soft/80">
              {negocio.motivo}
            </p>

            {negocio.faltan.length > 0 && (
              <p className="mt-gap-xs rounded-xl border border-lv-amber/30 bg-lv-amber/10 px-gap-sm py-2 text-meta text-ink">
                Revisión automática: faltan {negocio.faltan.join(" · ")}
              </p>
            )}

            {negocio.reviewStatus === "pending" && !negocio.puedeAprobar && (
              <p className="mt-gap-xs text-meta text-destructive-ink">
                Falta el tipo de negocio.{" "}
                <Link
                  href="/admin/solicitudes"
                  className="font-semibold underline underline-offset-2"
                >
                  Asignarlo en Solicitudes
                </Link>
                .
              </p>
            )}

            <div className="mt-gap-sm flex flex-wrap gap-gap-xs">
              <BotonAdmin
                tamano="pequeno"
                onClick={() => onAbrirFicha(negocio.id)}
              >
                <ExternalLink size={15} strokeWidth={1.8} />
                Abrir ficha 360
              </BotonAdmin>

              {negocio.reviewStatus === "pending" && (
                <BotonAdmin
                  tamano="pequeno"
                  variante={confirmarAprobacion ? "primario" : "secundario"}
                  onClick={() => void aprobar()}
                  disabled={!negocio.puedeAprobar || aprobando}
                  title={
                    negocio.puedeAprobar
                      ? undefined
                      : "Completa lo que falta antes de aprobar."
                  }
                >
                  {aprobando ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                  )}
                  {confirmarAprobacion ? "Confirmar aprobación" : "Aprobar ficha"}
                </BotonAdmin>
              )}

              {confirmarAprobacion && (
                <BotonAdmin
                  tamano="pequeno"
                  onClick={() => setConfirmarAprobacion(false)}
                  disabled={aprobando}
                >
                  Cancelar
                </BotonAdmin>
              )}
            </div>
          </>
        ) : (
          <p className="mt-gap-sm flex items-start gap-gap-xs text-small text-ink-soft/75">
            <UserRound size={15} strokeWidth={1.8} className="mt-[2px] shrink-0" />
            Esta persona no tiene un negocio vinculado.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-ink/5 bg-white p-gap-md">
        <div className="flex items-center gap-gap-xs">
          <ArrowUpRight size={16} strokeWidth={1.8} className="text-verde-600" />
          <h2 className="font-lv-display text-small font-semibold text-ink">
            Pista de la conversación
          </h2>
        </div>
        <p className="mt-gap-sm text-small text-ink-soft/80">
          {conversacion.pagePath
            ? `Escribió desde ${conversacion.pagePath}.`
            : "No indicó desde qué pantalla escribió."}
        </p>
        <p className="mt-gap-xs text-meta text-ink-soft/65">
          Abierta el {FECHA.format(new Date(conversacion.createdAt))}
        </p>
      </section>
    </div>
  );
}
