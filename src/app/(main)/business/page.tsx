"use client";

import { useState } from "react";
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
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/logout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { MapLocationPicker, type LocationPoint } from "@/components/map/MapLocationPicker";
import { formatCoordinates } from "@/lib/map/coordinates";
import { BUSINESS_CATEGORIES, placeIcon } from "@/lib/places";
import { CategoryIcon } from "@/components/admin/category-icon";
import { IconPicker } from "@/components/ui/icon-picker";
import { PanelShell } from "@/components/business/panel-shell";
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

/* `Input`, `Button`, `Label` y `Badge` viven en `components/ui` y siguen en el
   sistema viejo: los usan también `/admin` y `/profile`, que van en su propia
   fase. Aquí se reajustan desde el sitio de llamada en vez de tocar el
   primitivo, que cambiaría esas rutas sin revisarlas. */
const INPUT =
  "rounded-xl border-ink/10 bg-white text-ink placeholder:text-ink-soft/75 focus-visible:border-verde-400 focus-visible:ring-offset-0 focus-visible:ring-verde-400/30";
const BTN_PRIMARY =
  "rounded-full bg-verde-400 text-verde-950 shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)] hover:bg-verde-300 duration-500 ease-outquint active:scale-[0.98]";
const BTN_OUTLINE =
  "rounded-full border-ink/10 bg-white text-ink hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600 duration-500 ease-outquint";

/**
 * Encabezado de sección del panel. El nombre ya lo dice el botón que la abre
 * —barra lateral en escritorio, nav inferior en móvil—, así que aquí no se
 * repite: queda solo la línea que describe la pantalla.
 *
 * El `h1` sigue ahí, oculto: sin él la pantalla no tendría encabezado de nivel 1
 * y un lector de pantalla no anunciaría dónde está el usuario.
 */
function ViewLead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-gap-md">
      <h1 className="sr-only">{title}</h1>
      <p className="text-small text-ink-soft/75">{subtitle}</p>
    </div>
  );
}

function DashboardView() {
  return (
    <>
      <ViewLead title="Dashboard" subtitle="Resumen de St. Pauli" />

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
          <h3 className="font-lv-display text-body font-semibold text-ink mb-gap-sm">Actividad reciente</h3>
          <div className="bg-white border border-ink/5 rounded-2xl p-gap-sm shadow-soft">
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

function EditorView({
  location,
  onLocationChange,
}: {
  location: LocationPoint | null;
  onLocationChange: (point: LocationPoint | null) => void;
}) {
  const [bizName, setBizName] = useState("St. Pauli Restaurant-Bar");
  const [category, setCategory] = useState("restaurante");
  /* `null` significa «el de mi categoría». Mientras el dueño no elija, el pin
     sigue a la categoría —cámbiala y el icono cambia con ella—; en cuanto elige
     uno, manda su elección. Por eso el estado guarda el vacío y no una copia
     del de la categoría, que se quedaría congelada al primer render. */
  const [icon, setIcon] = useState<string | null>(null);
  const [description, setDescription] = useState(
    "Bar-restaurante en plena Enramadas: cocina cubana y de taberna, ambiente que va subiendo de tono a la noche.",
  );
  const [address, setAddress] = useState("Enramadas (José A. Saco) 605, e/ Barnada y Plácido, Santiago de Cuba");
  const [offerEnabled, setOfferEnabled] = useState(true);
  const [offerTitle, setOfferTitle] = useState("2x1 en mojitos todos los jueves");
  const [offerExpiry, setOfferExpiry] = useState("31 de agosto, 2026");

  /* El desplegable de categoría guarda el `value` ("restaurante"); el catálogo
     de iconos va por la etiqueta ("Restaurante"). Traducir aquí, una vez, es
     más barato que mantener dos tablas paralelas. */
  const categoryLabel =
    BUSINESS_CATEGORIES.find((c) => c.value === category)?.label ?? "Otro";
  const resolvedIcon = placeIcon(icon ?? undefined, categoryLabel);

  return (
    <>
      <ViewLead
        title="Editar ficha"
        subtitle="St. Pauli Restaurant-Bar, Enramadas, Santiago de Cuba"
      />

      <div className="space-y-gap-md">
        {/* Photos */}
        <FormSection
          title="Fotos del lugar"
          icon={<Image size={18} strokeWidth={1.8} />}
        >
          {/* ponytail: el id va a fuego porque este panel entero lo está —el
              nombre, los horarios y las métricas también—, y es el negocio que
              siembra `db:seed`. El día que `/business` deje de ser un prototipo,
              el id sale de `business_owners` para el usuario de la sesión. */}
          <PhotoGrid placeId="st-pauli" placeName={bizName} />
        </FormSection>

        {/* Basic Info */}
        <FormSection
          title="Información básica"
          icon={<User size={18} strokeWidth={1.8} />}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizName">Nombre del negocio</Label>
              <Input
                id="bizName"
                className={INPUT}
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
                className="flex h-auto min-h-[100px] w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-body text-ink placeholder:text-ink-soft/75 outline-none focus:border-verde-400 focus:ring-2 focus:ring-verde-400/30 resize-y leading-relaxed transition-colors duration-500 ease-outquint"
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizAddress">Dirección</Label>
              <Input
                id="bizAddress"
                className={INPUT}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Dirección completa"
              />
            </div>
          </div>
        </FormSection>

        {/* Icono. Va pegado a la información básica porque sale de ella: la
            categoría de arriba es la que decide el icono mientras el dueño no
            elija uno. */}
        <FormSection
          title="Icono del negocio"
          icon={<CategoryIcon icon={resolvedIcon} size={18} strokeWidth={1.8} />}
        >
          <p className="text-meta text-ink-soft/75 mb-gap-sm">
            Es el dibujo que llevas en el pin del mapa, en el popup y en tu
            tarjeta. Mientras no elijas uno llevas el de tu categoría, y si
            cambias de categoría el icono cambia contigo.
          </p>
          <IconPicker
            value={resolvedIcon}
            onChange={setIcon}
            label="Icono del negocio"
            preview={bizName || "Tu negocio"}
          />
          {icon !== null && (
            <button
              type="button"
              onClick={() => setIcon(null)}
              className="mt-gap-sm self-start font-lv-display text-meta font-semibold text-verde-600 transition-colors duration-500 ease-outquint hover:text-verde-700 cursor-pointer"
            >
              Usar el de mi categoría
            </button>
          )}
        </FormSection>

        {/* Ubicación. Va justo debajo de la información básica porque es el
            mismo dato: la dirección de arriba es texto, y esto es el punto.
            La dirección solo se reescribe si la que hay está vacía o no trae
            entre-calles: quien escribió «e/ A y B» ya fue más preciso que el
            geocodificador y no se le pisa. */}
        <FormSection
          title="Ubicación en el mapa"
          icon={<MapPin size={18} strokeWidth={1.8} />}
        >
          <p className="text-meta text-ink-soft/75 mb-gap-sm">
            Busca tu dirección, elige la coincidencia y ajusta el pin. Ese punto
            es el que ven los usuarios cuando piden cómo llegar.
          </p>
          <MapLocationPicker
            value={location}
            onChange={onLocationChange}
            onResolved={(r) => {
              if (!r) return;
              setAddress((prev) =>
                prev.trim() === "" || !/e\/|entre/i.test(prev) ? r.address : prev,
              );
            }}
          />
        </FormSection>

        {/* Hours + Payment — side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
          <FormSection
            title="Horarios"
            icon={<Clock size={18} strokeWidth={1.8} />}
          >
            <HoursEditor />
          </FormSection>

          <FormSection
            title="Métodos de pago"
            icon={<CreditCard size={18} strokeWidth={1.8} />}
          >
            <p className="text-meta text-ink-soft/75 mb-gap-sm">Selecciona las monedas y métodos de pago que acepta tu negocio.</p>
            <PaymentChips />
          </FormSection>
        </div>

        {/* Menu + Offer — side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
          <FormSection
            title="Lo que ofreces"
            icon={<Utensils size={18} strokeWidth={1.8} />}
          >
            <p className="text-meta text-ink-soft/75 mb-gap-sm">Añade tus productos o servicios más populares. Aparecen en la ficha del lugar.</p>
            <MenuItemEditor />
          </FormSection>

          <FormSection
            title="Oferta especial"
            icon={<Tag size={18} strokeWidth={1.8} />}
          >
            <div className="flex items-center justify-between py-gap-sm border-b border-ink/5 gap-gap-sm">
              <div className="flex-1 min-w-0">
                <div className="text-small font-medium text-ink">Oferta activa</div>
                <div className="text-meta text-ink-soft/75">Muestra un banner de oferta en tu ficha</div>
              </div>
              <Switch
                checked={offerEnabled}
                onToggle={() => setOfferEnabled((prev) => !prev)}
                label="Oferta activa"
              />
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
                        className={INPUT}
                        value={offerTitle}
                        onChange={(e) => setOfferTitle(e.target.value)}
                        placeholder="Ej: 2x1 en bebidas, Almuerzo del día..."
                      />
                    </div>
                    <div className="flex flex-col gap-gap-xs">
                      <Label htmlFor="offerExpiry">Válido hasta</Label>
                      <Input
                        id="offerExpiry"
                        className={INPUT}
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
          icon={<Zap size={18} strokeWidth={1.8} />}
        >
          <div className="bg-verde-50 border border-verde-200 rounded-2xl p-gap-md flex flex-col gap-gap-sm">
            <div className="font-lv-display text-[10px] font-semibold text-verde-600 uppercase tracking-[0.22em]">
              Plan Destacado
            </div>
            <div className="font-lv-display text-body font-semibold text-ink">
              Tu negocio aparece primero en búsquedas relacionadas
            </div>
            <div className="text-small text-ink-soft/75">
              Pin verde en el mapa, prioridad en recomendaciones IA, badge &ldquo;Destacado&rdquo; en la ficha.
            </div>
            <div className="flex items-baseline gap-gap-xs mt-gap-xs">
              <span className="font-lv-display text-h3 font-bold text-ink">25</span>
              <span className="font-lv-display text-meta text-ink-soft/75">USD / mes</span>
            </div>
            <Button className={cn("w-full mt-gap-xs", BTN_PRIMARY)}>
              <Zap size={18} strokeWidth={1.8} />
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
      <ViewLead title="Vista previa" subtitle="Así se ve tu ficha en La Verde" />
      <PreviewPanel />
    </>
  );
}

/** Interruptor del sistema. Estaba duplicado, con las mismas clases, en el
    bloque de oferta y en `ToggleRow`. */
function Switch({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cn(
        "w-[48px] h-[28px] rounded-full relative cursor-pointer border-none p-0 transition-colors duration-500 ease-outquint shrink-0",
        checked ? "bg-verde-400" : "bg-ink/10",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] left-[3px] size-[22px] rounded-full bg-white shadow-soft transition-transform duration-500 ease-outquint",
          checked && "translate-x-5",
        )}
      />
    </button>
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
    <div className="flex items-center justify-between py-gap-sm border-b border-ink/5 last:border-b-0 gap-gap-sm">
      <div className="flex-1 min-w-0">
        <div className="text-small font-medium text-ink">{label}</div>
        <div className="text-meta text-ink-soft/75">{description}</div>
      </div>
      <Switch checked={checked} onToggle={onToggle} label={label} />
    </div>
  );
}

function SettingsView({ location }: { location: LocationPoint | null }) {
  const [notifications, setNotifications] = useState(true);
  const [aiRecommendations, setAiRecommendations] = useState(true);
  const [showHours, setShowHours] = useState(true);

  return (
    <>
      <ViewLead title="Ajustes" subtitle="Configuración de tu negocio" />

      <div className="flex flex-col flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
          <div className="bg-white border border-ink/5 rounded-2xl shadow-soft p-gap-md">
            {[
              { label: "Nombre del negocio", description: "Aparece en La Verde y en resultados de búsqueda", value: "St. Pauli Restaurant-Bar" },
              { label: "Categoría principal", description: "Ayuda a la IA a recomendar tu negocio", value: "Restaurante" },
              /* Estas coordenadas ya no están escritas a mano: son las del pin
                 que se mueve en «Editar». Se cambian allí y aquí se leen. */
              { label: "Ubicación en el mapa", description: "Coordenadas GPS del punto exacto", value: location ? formatCoordinates(location) : "Sin punto" },
            ].map((field) => (
              <div key={field.label} className="flex items-center justify-between py-gap-sm border-b border-ink/5 last:border-b-0 gap-gap-sm">
                <div className="flex-1 min-w-0">
                  <div className="text-small font-medium text-ink">{field.label}</div>
                  <div className="text-meta text-ink-soft/75">{field.description}</div>
                </div>
                <span className="font-lv-display text-meta text-ink-soft/75 px-[10px] py-[4px] bg-sand-deep rounded-full shrink-0">
                  {field.value}
                </span>
              </div>
            ))}
          </div>

          <div className="bg-white border border-ink/5 rounded-2xl shadow-soft p-gap-md">
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

          <div className="bg-white border border-ink/5 rounded-2xl shadow-soft p-gap-md">
            <div className="flex items-center justify-between py-gap-sm border-b border-ink/5 last:border-b-0 gap-gap-sm">
              <div className="flex-1 min-w-0">
                <div className="text-small font-medium text-ink">Plan actual</div>
                <div className="text-meta text-ink-soft/75">Tu nivel de servicio en La Verde</div>
              </div>
              <span className="font-lv-display text-meta font-semibold bg-verde-50 text-verde-600 px-[10px] py-[3px] rounded-full border border-verde-200 shrink-0">
                Básico (gratis)
              </span>
            </div>
            <div className="flex items-center justify-between py-gap-sm gap-gap-sm">
              <div className="flex-1 min-w-0">
                <div className="text-small font-medium text-ink">Contacto de soporte</div>
                <div className="text-meta text-ink-soft/75">Ayuda con tu cuenta o ficha</div>
              </div>
              <span className="font-lv-display text-meta text-ink-soft/75 shrink-0">soporte@laverde.cu</span>
            </div>
          </div>
        </div>

        {/* Este botón no hacía nada: era un `<Button>` sin `onClick`. Ahora
            cierra la sesión, la misma que el resto del sitio. */}
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-auto self-start inline-flex items-center gap-gap-xs h-11 px-gap-lg rounded-full font-lv-display text-small font-semibold text-destructive hover:bg-destructive/10 transition-colors duration-500 ease-outquint cursor-pointer"
        >
          <LogOut size={18} strokeWidth={1.8} />
          Cerrar sesión
        </button>
      </div>
    </>
  );
}

export default function BusinessPage() {
  /* El punto del negocio vive aquí y no dentro de cada vista: el mismo dato se
     pinta en el mapa de «Editar» y en el resumen de «Ajustes», y con dos estados
     separados las dos pantallas acababan diciendo cosas distintas del mismo
     negocio. Sembrado con el centro de Santiago, que es dónde está el negocio de
     ejemplo; sin siembra el mapa arrancaría sin pin. */
  const [location, setLocation] = useState<LocationPoint | null>({
    lat: 20.021,
    lng: -75.825,
  });

  return (
    <PanelShell>
      {(view) => {
        switch (view) {
          case "dashboard":
            return <DashboardView />;
          case "editor":
            return <EditorView location={location} onLocationChange={setLocation} />;
          case "preview":
            return <PreviewView />;
          case "settings":
            return <SettingsView location={location} />;
        }
      }}
    </PanelShell>
  );
}
