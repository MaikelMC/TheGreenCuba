"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Image,
  Clock,
  User,
  CreditCard,
  Utensils,
  Tag,
  Zap,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { PanelShell, type PanelView } from "@/components/business/panel-shell";
import { DashboardStats } from "@/components/business/dashboard-stats";
import { MiniChart } from "@/components/business/mini-chart";
import { AIInsightCard } from "@/components/business/ai-insight-card";
import { ActivityItem } from "@/components/business/activity-item";
import { FormSection } from "@/components/business/form-section";
import { PhotoGrid } from "@/components/business/photo-grid";
import { HoursEditor } from "@/components/business/hours-editor";
import { MenuItemEditor } from "@/components/business/menu-item-editor";
import { PaymentChips } from "@/components/business/payment-chips";
import { PreviewPanel } from "@/components/business/preview-panel";
import { SaveBar } from "@/components/business/save-bar";

const CHART_DATA = [18, 24, 32, 28, 45, 52, 38, 42, 56, 48, 62, 55, 44, 49];
const CHART_LABELS = ["11 jul", "18 jul", "25 jul"];

function DashboardView() {
  return (
    <>
      <div className="flex items-center justify-between gap-gap-sm mb-gap-lg">
        <div>
          <h1 className="font-display text-h3 font-bold text-foreground">Dashboard</h1>
          <p className="text-small text-muted-foreground mt-gap-2xs">Resumen de St. Pauli</p>
        </div>
      </div>

      <DashboardStats
        stats={[
          { label: "Visitas esta semana", value: "342", change: { value: "+18%", direction: "up" } },
          { label: "Clics en \"Cómo llegar\"", value: "87", change: { value: "+24%", direction: "up" } },
          { label: "Recomendaciones IA", value: "156", change: { value: "+31%", direction: "up" } },
          { label: "Guardados", value: "54", change: { value: "= mismo", direction: "neutral" } },
        ]}
      />

      <div className="mt-gap-lg grid grid-cols-1 lg:grid-cols-3 gap-gap-md">
        <div className="lg:col-span-2 space-y-gap-md">
          <MiniChart data={CHART_DATA} labels={CHART_LABELS} />

          <AIInsightCard>
            Los usuarios te recomiendan más los fines de semana para <strong>&ldquo;cena romántica&rdquo;</strong> y entre semana para <strong>&ldquo;almuerzo de negocios&rdquo;</strong>. Considera publicar ofertas específicas por día.
          </AIInsightCard>
        </div>

        <div>
          <h3 className="font-display text-body font-semibold text-foreground mb-gap-sm">Actividad reciente</h3>
          <div className="bg-surface border border-border rounded-lv-lg p-gap-sm">
            <ActivityItem type="search" time="hace 12 min">
              <strong>Alguien te buscó:</strong> &ldquo;restaurante en el centro que acepte USD Clásica&rdquo;
            </ActivityItem>
            <ActivityItem type="nav" time="hace 1 hora">
              <strong>Navegaron a ti:</strong> 3 personas pidieron indicaciones hoy
            </ActivityItem>
            <ActivityItem type="save" time="hoy">
              <strong>Guardaron tu lugar:</strong> &ldquo;St. Pauli&rdquo; se añadió a 5 listas nuevas
            </ActivityItem>
            <ActivityItem type="view" time="hoy">
              <strong>Vista de ficha:</strong> 28 personas vieron tu perfil completo
            </ActivityItem>
            <ActivityItem type="search" time="ayer">
              <strong>Recomendación IA:</strong> Apareciste en &ldquo;mejores restaurantes criollos de Santiago&rdquo;
            </ActivityItem>
          </div>
        </div>
      </div>
    </>
  );
}

function EditorView() {
  const [bizName, setBizName] = useState("St. Pauli Restaurant-Bar");
  const [category, setCategory] = useState("restaurante");
  const [description, setDescription] = useState(
    "Bar-restaurante en plena Enramadas: cocina cubana y de taberna, ambiente que va subiendo de tono a la noche.",
  );
  const [address, setAddress] = useState("Enramadas (José A. Saco) 605, e/ Barnada y Plácido, Santiago de Cuba");
  const [offerEnabled, setOfferEnabled] = useState(true);
  const [offerTitle, setOfferTitle] = useState("2x1 en mojitos todos los jueves");
  const [offerExpiry, setOfferExpiry] = useState("31 de agosto, 2026");

  return (
    <>
      <div className="flex items-center justify-between gap-gap-sm mb-gap-lg">
        <div>
          <h1 className="font-display text-h3 font-bold text-foreground">Editar ficha</h1>
          <p className="text-small text-muted-foreground mt-gap-2xs">St. Pauli Restaurant-Bar, Enramadas, Santiago de Cuba</p>
        </div>
      </div>

      <div className="space-y-gap-md">
        {/* Photos */}
        <FormSection
          title="Fotos del lugar"
          icon={<Image size={18} strokeWidth={1.5} />}
        >
          <PhotoGrid />
        </FormSection>

        {/* Basic Info */}
        <FormSection
          title="Información básica"
          icon={<User size={18} strokeWidth={1.5} />}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizName">Nombre del negocio</Label>
              <Input
                id="bizName"
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                placeholder="Nombre que aparece en La Verde"
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizCategory">Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="bizCategory">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restaurante">Restaurante</SelectItem>
                  <SelectItem value="cafeteria">Cafetería</SelectItem>
                  <SelectItem value="discoteca">Discoteca / Bar</SelectItem>
                  <SelectItem value="mercado">Mercado</SelectItem>
                  <SelectItem value="tienda">Tienda</SelectItem>
                  <SelectItem value="servicio">Servicio</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-gap-xs lg:col-span-2">
              <Label htmlFor="bizDesc">Descripción</Label>
              <textarea
                id="bizDesc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe tu negocio para que la IA recomiende mejor..."
                className="flex h-auto min-h-[100px] w-full rounded-lv border border-input bg-surface px-4 py-3 text-body text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y leading-relaxed"
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizAddress">Dirección</Label>
              <Input
                id="bizAddress"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Dirección completa"
              />
            </div>
          </div>
        </FormSection>

        {/* Hours + Payment — side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
          <FormSection
            title="Horarios"
            icon={<Clock size={18} strokeWidth={1.5} />}
          >
            <HoursEditor />
          </FormSection>

          <FormSection
            title="Métodos de pago"
            icon={<CreditCard size={18} strokeWidth={1.5} />}
          >
            <p className="text-meta text-muted-foreground mb-gap-sm">Selecciona las monedas y métodos de pago que acepta tu negocio.</p>
            <PaymentChips />
          </FormSection>
        </div>

        {/* Menu + Offer — side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
          <FormSection
            title="Menú / Ofertas destacadas"
            icon={<Utensils size={18} strokeWidth={1.5} />}
          >
            <p className="text-meta text-muted-foreground mb-gap-sm">Añade tus platos o servicios más populares. Aparecen en la ficha del lugar.</p>
            <MenuItemEditor />
          </FormSection>

          <FormSection
            title="Oferta especial"
            icon={<Tag size={18} strokeWidth={1.5} />}
          >
            <div className="flex items-center justify-between py-gap-sm border-b border-border gap-gap-sm">
              <div className="flex-1 min-w-0">
                <div className="text-small font-medium">Oferta activa</div>
                <div className="text-meta text-muted-foreground">Muestra un banner de oferta en tu ficha</div>
              </div>
              <button
                type="button"
                onClick={() => setOfferEnabled((prev) => !prev)}
                role="switch"
                aria-checked={offerEnabled}
                className={cn(
                  "w-[48px] h-[28px] rounded-full relative cursor-pointer border-none p-0 transition-colors duration-normal shrink-0",
                  offerEnabled ? "bg-accent" : "bg-border",
                )}
              >
                <span
                  className={cn(
                    "absolute top-[3px] left-[3px] size-[22px] rounded-full bg-white shadow-lv-xs transition-transform duration-normal ease-out",
                    offerEnabled && "translate-x-5",
                  )}
                />
              </button>
            </div>
            {offerEnabled && (
              <AnimatePresence initial={false}>
                <motion.div
                  key="offer-fields"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-gap-xs mt-gap-sm">
                    <div className="flex flex-col gap-gap-xs">
                      <Label htmlFor="offerTitle">Título de la oferta</Label>
                      <Input
                        id="offerTitle"
                        value={offerTitle}
                        onChange={(e) => setOfferTitle(e.target.value)}
                        placeholder="Ej: 2x1 en bebidas, Almuerzo del día..."
                      />
                    </div>
                    <div className="flex flex-col gap-gap-xs">
                      <Label htmlFor="offerExpiry">Válido hasta</Label>
                      <Input
                        id="offerExpiry"
                        value={offerExpiry}
                        onChange={(e) => setOfferExpiry(e.target.value)}
                        placeholder="Fecha de expiración"
                      />
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </FormSection>
        </div>

        {/* Boost */}
        <FormSection
          title="Destacar en La Verde"
          icon={<Zap size={18} strokeWidth={1.5} />}
        >
          <div className="bg-gradient-to-br from-lv-amber/10 to-lv-amber/5 border border-lv-amber/20 rounded-lv-lg p-gap-md flex flex-col gap-gap-sm">
            <div className="font-mono text-xs text-lv-amber uppercase tracking-[0.04em] font-medium">
              Plan Destacado
            </div>
            <div className="font-display text-body font-semibold">
              Tu negocio aparece primero en búsquedas relacionadas
            </div>
            <div className="text-small text-muted-foreground">
              Pin amber en el mapa, prioridad en recomendaciones IA, badge &ldquo;Destacado&rdquo; en la ficha.
            </div>
            <div className="flex items-baseline gap-gap-xs mt-gap-xs">
              <span className="font-display text-h3 font-bold text-foreground">25</span>
              <span className="font-mono text-xs text-muted-foreground">USD / mes</span>
            </div>
            <Button className="w-full mt-gap-xs">
              <Zap size={18} strokeWidth={1.5} />
              Activar destacado
            </Button>
          </div>
        </FormSection>
      </div>

      {/* Save Bar */}
      <SaveBar />
    </>
  );
}

function PreviewView() {
  return (
    <>
      <div className="flex items-center justify-between gap-gap-sm mb-gap-lg">
        <div>
          <h1 className="font-display text-h3 font-bold text-foreground">Vista previa</h1>
          <p className="text-small text-muted-foreground mt-gap-2xs">Así se ve tu ficha en La Verde</p>
        </div>
      </div>
      <PreviewPanel />
    </>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-gap-sm border-b border-border last:border-b-0 gap-gap-sm">
      <div className="flex-1 min-w-0">
        <div className="text-small font-medium">{label}</div>
        <div className="text-meta text-muted-foreground">{description}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        role="switch"
        aria-checked={checked}
        className={cn(
          "w-[48px] h-[28px] rounded-full relative cursor-pointer border-none p-0 transition-colors duration-normal shrink-0",
          checked ? "bg-accent" : "bg-border",
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] left-[3px] size-[22px] rounded-full bg-white shadow-lv-xs transition-transform duration-normal ease-out",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

function SettingsView() {
  const [notifications, setNotifications] = useState(true);
  const [aiRecommendations, setAiRecommendations] = useState(true);
  const [showHours, setShowHours] = useState(true);

  return (
    <>
      <div className="flex items-center justify-between gap-gap-sm mb-gap-lg">
        <div>
          <h1 className="font-display text-h3 font-bold text-foreground">Ajustes</h1>
          <p className="text-small text-muted-foreground mt-gap-2xs">Configuración de tu negocio</p>
        </div>
      </div>

      <div className="flex flex-col flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
          <div className="bg-surface border border-border rounded-lv-lg p-gap-md">
            {[
              { label: "Nombre del negocio", description: "Aparece en La Verde y en resultados de búsqueda", value: "St. Pauli Restaurant-Bar" },
              { label: "Categoría principal", description: "Ayuda a la IA a recomendar tu negocio", value: "Restaurante" },
              { label: "Ubicación en el mapa", description: "Coordenadas GPS del punto exacto", value: "20.021° N, 75.825° O" },
            ].map((field) => (
              <div key={field.label} className="flex items-center justify-between py-gap-sm border-b border-border last:border-b-0 gap-gap-sm">
                <div className="flex-1 min-w-0">
                  <div className="text-small font-medium">{field.label}</div>
                  <div className="text-meta text-muted-foreground">{field.description}</div>
                </div>
                <span className="font-mono text-xs text-muted-foreground px-[10px] py-[4px] bg-muted rounded-sm shrink-0">
                  {field.value}
                </span>
              </div>
            ))}
          </div>

          <div className="bg-surface border border-border rounded-lv-lg p-gap-md">
            <ToggleRow
              label="Notificaciones"
              description="Recibe avisos cuando alguien visita tu ficha"
              checked={notifications}
              onToggle={() => setNotifications((p) => !p)}
            />
            <ToggleRow
              label="Recomendaciones IA"
              description="Permitir que la IA recomiende tu negocio"
              checked={aiRecommendations}
              onToggle={() => setAiRecommendations((p) => !p)}
            />
            <ToggleRow
              label="Mostrar horarios"
              description="Visible en la ficha pública"
              checked={showHours}
              onToggle={() => setShowHours((p) => !p)}
            />
          </div>

          <div className="bg-surface border border-border rounded-lv-lg p-gap-md">
            <div className="flex items-center justify-between py-gap-sm border-b border-border last:border-b-0 gap-gap-sm">
              <div className="flex-1 min-w-0">
                <div className="text-small font-medium">Plan actual</div>
                <div className="text-meta text-muted-foreground">Tu nivel de servicio en La Verde</div>
              </div>
              <Badge variant="accent">Básico (gratis)</Badge>
            </div>
            <div className="flex items-center justify-between py-gap-sm gap-gap-sm">
              <div className="flex-1 min-w-0">
                <div className="text-small font-medium">Contacto de soporte</div>
                <div className="text-meta text-muted-foreground">Ayuda con tu cuenta o ficha</div>
              </div>
              <span className="font-mono text-xs text-muted-foreground">soporte@laverde.cu</span>
            </div>
          </div>
        </div>

        <Button variant="ghost" className="mt-auto self-start text-destructive hover:text-destructive hover:bg-destructive/10">
          <LogOut size={18} strokeWidth={1.5} />
          Cerrar sesión
        </Button>
      </div>
    </>
  );
}

export default function BusinessPage() {
  return (
    <PanelShell>
      {(view, setView) => {
        switch (view) {
          case "dashboard":
            return <DashboardView />;
          case "editor":
            return <EditorView />;
          case "preview":
            return <PreviewView />;
          case "settings":
            return <SettingsView />;
        }
      }}
    </PanelShell>
  );
}
