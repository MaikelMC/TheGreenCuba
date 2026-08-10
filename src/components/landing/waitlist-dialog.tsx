"use client";

import { useState } from "react";
import { Send, CheckCircle2, Clock, CreditCard, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BUSINESS_CATEGORIES } from "@/lib/places";
import { PaymentChips } from "@/components/business/payment-chips";
import { useWaitlistDialog } from "@/store/waitlist-dialog";

const SCHEDULE_PRESETS = [
  "8:00 – 16:00",
  "9:00 – 18:00",
  "10:00 – 22:00",
  "12:00 – 24:00",
  "24 horas",
];

const WEEK_DAYS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

interface FormState {
  businessName: string;
  category: string;
  city: string;
  address: string;
  schedule: string;
  days: string[];
  payments: string[];
  description: string;
  offerText: string;
  offerExpiry: string;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  businessName: "",
  category: "",
  city: "",
  address: "",
  schedule: "",
  days: [],
  payments: [],
  description: "",
  offerText: "",
  offerExpiry: "",
  contactName: "",
  phone: "",
  email: "",
  notes: "",
};

export function WaitlistDialog() {
  const { open, closeDialog } = useWaitlistDialog();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updatePayments = (value: string[]) =>
    setForm((prev) => ({ ...prev, payments: value }));

  const toggleDay = (day: string) =>
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day],
    }));

  const handleSubmit = async () => {
    setError(null);
    if (!form.businessName.trim()) {
      setError("Escribe el nombre del negocio.");
      return;
    }
    if (!form.contactName.trim()) {
      setError("Escribe tu nombre.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Escribe un telefono o WhatsApp de contacto.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName.trim(),
          category: form.category.trim(),
          city: form.city.trim(),
          address: form.address.trim(),
          schedule: form.schedule.trim(),
          days: form.days,
          payments: form.payments,
          description: form.description.trim(),
          offerText: form.offerText.trim(),
          offerExpiry: form.offerExpiry.trim(),
          contactName: form.contactName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          notes: form.notes.trim(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo guardar la solicitud.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("No se pudo guardar la solicitud. Revisa tu conexion.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setSubmitted(false);
    closeDialog();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? closeDialog() : handleClose())}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Unete a la lista</DialogTitle>
          <DialogDescription>
            Registra tu negocio y te avisaremos cuando La Verde salga en tu
            ciudad.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center gap-gap-sm py-gap-lg text-center">
            <CheckCircle2 size={44} strokeWidth={1.5} className="text-accent" />
            <p className="font-display text-body font-semibold text-foreground">
              Solicitud enviada
            </p>
            <p className="text-small text-muted-foreground max-w-[40ch]">
              Gracias por registrar{" "}
              <span className="font-semibold text-foreground">
                {form.businessName.trim() || "tu negocio"}
              </span>
              . Nos pondremos en contacto contigo.
            </p>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cerrar
            </Button>
          </div>
        ) : (
          <div className="space-y-gap-md">
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="wlName">Nombre del negocio *</Label>
              <Input
                id="wlName"
                value={form.businessName}
                onChange={(e) => update("businessName", e.target.value)}
                placeholder="Ej: Paladar El Sabroso"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="wlCategory">Categoria</Label>
              <select
                id="wlCategory"
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                className="h-12 w-full rounded-lv border border-input bg-surface px-4 py-2 text-body text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Selecciona una categoria</option>
                {BUSINESS_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.label}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-gap-md sm:grid-cols-2">
              <div className="flex flex-col gap-gap-xs">
                <Label htmlFor="wlCity">Ciudad / Municipio</Label>
                <Input
                  id="wlCity"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  placeholder="Ej: La Habana, Matanzas..."
                />
              </div>
              <div className="flex flex-col gap-gap-xs">
                <Label htmlFor="wlAddress">Direccion</Label>
                <Input
                  id="wlAddress"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="Ej: Calle 12 #45, Vedado"
                />
              </div>
            </div>

            <div className="rounded-lv-lg border border-border bg-surface p-gap-md">
              <div className="flex items-center gap-2 text-small font-medium text-foreground mb-gap-xs">
                <Clock size={14} strokeWidth={1.5} className="text-accent" />
                Horario de atencion
              </div>
              <div className="flex flex-col gap-gap-xs mb-gap-sm">
                <Label htmlFor="wlSchedule">Horario</Label>
                <Input
                  id="wlSchedule"
                  value={form.schedule}
                  onChange={(e) => update("schedule", e.target.value)}
                  placeholder="Ej: 10:00 – 22:00"
                />
                <div className="flex flex-wrap gap-[6px]">
                  {SCHEDULE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => update("schedule", preset)}
                      className={
                        "px-3 py-[6px] rounded-full border text-[12px] font-medium transition-all " +
                        (form.schedule === preset
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-foreground bg-background hover:border-accent hover:text-accent")
                      }
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-gap-xs">
                <Label>Dias de la semana que abre</Label>
                <div className="flex flex-wrap gap-[6px]">
                  {WEEK_DAYS.map((day) => {
                    const active = form.days.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={
                          "px-3 py-[6px] rounded-full border text-[12px] font-medium transition-all " +
                          (active
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border text-foreground bg-background hover:border-accent hover:text-accent")
                        }
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-lv-lg border border-border bg-surface p-gap-md">
              <div className="flex items-center gap-2 text-small font-medium text-foreground mb-gap-xs">
                <CreditCard size={14} strokeWidth={1.5} className="text-accent" />
                Monedas y metodos de pago
              </div>
              <p className="text-meta text-muted-foreground -mt-gap-2xs mb-gap-sm">
                Que acepta el negocio. Aparece en la ficha del lugar.
              </p>
              <PaymentChips
                defaultSelected={form.payments}
                onChange={updatePayments}
              />
            </div>

            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="wlDescription">Descripcion del negocio</Label>
              <textarea
                id="wlDescription"
                rows={3}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Describe el negocio, su ambiente y servicios..."
                className="flex h-auto min-h-[72px] w-full resize-y rounded-lv border border-input bg-surface px-4 py-3 text-body text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div className="rounded-lv-lg border border-border bg-surface p-gap-md">
              <div className="flex items-center gap-2 text-small font-medium text-foreground mb-gap-xs">
                <Tag size={14} strokeWidth={1.5} className="text-accent" />
                Oferta especial (opcional)
              </div>
              <div className="grid grid-cols-1 gap-gap-xs sm:grid-cols-2">
                <div className="flex flex-col gap-gap-xs">
                  <Label htmlFor="wlOfferText">Texto de la oferta</Label>
                  <Input
                    id="wlOfferText"
                    value={form.offerText}
                    onChange={(e) => update("offerText", e.target.value)}
                    placeholder="Ej: 2x1 en bebidas"
                  />
                </div>
                <div className="flex flex-col gap-gap-xs">
                  <Label htmlFor="wlOfferExpiry">Valido hasta</Label>
                  <Input
                    id="wlOfferExpiry"
                    value={form.offerExpiry}
                    onChange={(e) => update("offerExpiry", e.target.value)}
                    placeholder="Ej: 30 de septiembre"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="wlContact">Tu nombre (persona de contacto) *</Label>
              <Input
                id="wlContact"
                value={form.contactName}
                onChange={(e) => update("contactName", e.target.value)}
                placeholder="Ej: Maria Gonzalez"
              />
            </div>

            <div className="grid grid-cols-1 gap-gap-md sm:grid-cols-2">
              <div className="flex flex-col gap-gap-xs">
                <Label htmlFor="wlPhone">Telefono / WhatsApp *</Label>
                <Input
                  id="wlPhone"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="Ej: +53 5 123 4567"
                  inputMode="tel"
                />
              </div>
              <div className="flex flex-col gap-gap-xs">
                <Label htmlFor="wlEmail">Email</Label>
                <Input
                  id="wlEmail"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                />
              </div>
            </div>

            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="wlNotes">Notas (opcional)</Label>
              <textarea
                id="wlNotes"
                rows={3}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Cuentanos algo mas de tu negocio..."
                className="flex h-auto min-h-[72px] w-full resize-y rounded-lv border border-input bg-surface px-4 py-3 text-body text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {error && (
              <div className="rounded-lv-lg bg-destructive/10 border border-destructive/25 px-3 py-[7px] text-[12px] text-destructive font-medium">
                {error}
              </div>
            )}

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full"
            >
              <Send size={18} strokeWidth={1.5} />
              {submitting ? "Enviando..." : "Enviar solicitud"}
            </Button>
            <p className="text-center text-meta text-muted-foreground">
              Los datos se guardan de forma segura para contactarte.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
