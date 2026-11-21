"use client";

/**
 * Cómo se entera el negocio de un pedido nuevo, en Ajustes de pedidos.
 *
 * - **Sonido y vibración** con el panel abierto: preferencia de este teléfono
 *   (`localStorage`), activada por defecto. «Probar el sonido» suena igual que
 *   un pedido de verdad.
 * - **Avisos push** con el panel cerrado: el permiso del navegador se pide solo
 *   desde aquí, con este botón, nunca al entrar (`altaPushDispositivo`). El
 *   envío lo hace el servidor al guardarse cada pedido.
 */

import { useEffect, useState } from "react";
import { BellRing, Loader2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { altaPushDispositivo, esIos, estaInstalada, soportaPush } from "@/lib/pwa/push-client";
import {
  guardarSonidoPedidos,
  sonarPedidoNuevo,
  sonidoPedidosActivo,
} from "./pedidos-pendientes";
import { Chapita, FilaAjuste, TarjetaAjuste } from "./ui/tarjeta";
import { BotonPrimario, BotonTexto } from "./ui/botones";
import { Switch } from "./ui/switch";

type EstadoPush = "cargando" | "sin-soporte" | "ios-sin-instalar" | "activado" | "denegado" | "pendiente";

function leerEstadoPush(): EstadoPush {
  if (!soportaPush()) return esIos() && !estaInstalada() ? "ios-sin-instalar" : "sin-soporte";
  if (Notification.permission === "granted") return "activado";
  if (Notification.permission === "denied") return "denegado";
  return "pendiente";
}

export function AvisosPedidosCard() {
  /* `localStorage` y `Notification` no existen en el servidor: se leen al montar. */
  const [sonido, setSonido] = useState(true);
  const [push, setPush] = useState<EstadoPush>("cargando");
  const [activando, setActivando] = useState(false);

  useEffect(() => {
    setSonido(sonidoPedidosActivo());
    setPush(leerEstadoPush());
  }, []);

  async function activarPush() {
    if (activando) return;
    setActivando(true);
    try {
      const resultado = await altaPushDispositivo();
      if (resultado.ok) {
        setPush("activado");
        toast.success("Avisos activados en este teléfono");
        return;
      }
      if (resultado.motivo === "denegado") setPush("denegado");
      toast.error(
        resultado.mensaje ??
          (resultado.motivo === "denegado"
            ? "El navegador tiene los avisos bloqueados para La Verde."
            : "No se pudieron activar los avisos. Inténtalo otra vez."),
      );
    } catch {
      toast.error("No se pudieron activar los avisos. Revisa la conexión.");
    } finally {
      setActivando(false);
    }
  }

  return (
    <TarjetaAjuste
      icono={BellRing}
      titulo="Avisos de pedidos nuevos"
      estado={
        push === "activado" ? <Chapita tono="activa">Push activo</Chapita> : undefined
      }
      apoyo="Cómo te enteras de un pedido nuevo en este teléfono."
    >
      <FilaAjuste
        titulo="Sonido y vibración"
        detalle={
          sonido
            ? "Suena con el panel abierto, en cualquier pantalla."
            : "Apagado: solo verás el aviso en pantalla."
        }
        control={
          <Switch
            checked={sonido}
            label="Sonido y vibración al entrar un pedido"
            onToggle={() => {
              const siguiente = !sonido;
              setSonido(siguiente);
              guardarSonidoPedidos(siguiente);
            }}
          />
        }
      />
      {sonido && (
        <BotonTexto onClick={sonarPedidoNuevo} className="mt-gap-xs gap-gap-xs">
          <Volume2 size={16} strokeWidth={1.8} />
          Probar el sonido
        </BotonTexto>
      )}

      <div className="mt-gap-md border-t border-ink/5 pt-gap-sm">
        <div className="text-small font-medium text-ink">Avisos con el panel cerrado</div>
        {push === "cargando" ? null : push === "activado" ? (
          <p className="text-meta text-ink-soft/75">
            Este teléfono recibe un aviso con cada pedido nuevo.
          </p>
        ) : push === "denegado" ? (
          <p className="text-meta text-ink-soft/75">
            El navegador los tiene bloqueados. Actívalos en los ajustes del navegador para La
            Verde y vuelve aquí.
          </p>
        ) : push === "ios-sin-instalar" ? (
          <p className="text-meta text-ink-soft/75">
            En iPhone, primero añade La Verde a la pantalla de inicio y ábrela desde allí.
          </p>
        ) : push === "sin-soporte" ? (
          <p className="text-meta text-ink-soft/75">Este navegador no admite avisos.</p>
        ) : (
          <>
            <p className="text-meta text-ink-soft/75">
              Te llega un aviso aunque tengas el panel cerrado.
            </p>
            <BotonPrimario onClick={() => void activarPush()} disabled={activando} className="mt-gap-sm">
              {activando && <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />}
              Activar avisos en este teléfono
            </BotonPrimario>
          </>
        )}
      </div>
    </TarjetaAjuste>
  );
}
