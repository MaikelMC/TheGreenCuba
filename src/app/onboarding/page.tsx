"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  OnboardingShell,
  StatusBar,
} from "@/components/onboarding/onboarding-shell";
import { WelcomeSplash } from "@/components/onboarding/welcome-splash";
import { LocationPicker } from "@/components/onboarding/location-picker";
import { PreferenceChip } from "@/components/onboarding/preference-chip";
import { CurrencyToggle } from "@/components/onboarding/currency-toggle";
import { StepBar, StepDots } from "@/components/onboarding/step-indicator";
import { PreferencesScreen } from "@/components/onboarding/preferences-screen";
import { ProvinceMap } from "@/components/onboarding/province-map";
import { cn } from "@/lib/utils";
import {
  writeUserPreferences,
  DEFAULT_USER_PREFERENCES,
} from "@/lib/user-preferences-store";
import {
  getCurrentPosition,
  detectNearestCity,
  GEO_ERROR_MESSAGES,
} from "@/lib/map/geolocation";

const LOCATION_NAMES: Record<string, string> = {
  "la-habana": "La Habana",
  santiago: "Santiago de Cuba",
  varadero: "Varadero",
  otra: "Otra ciudad",
};

const INTEREST_NAMES: Record<string, string> = {
  cafes: "Cafeterías",
  restaurantes: "Restaurantes",
  discotecas: "Discotecas",
  mercados: "Mercados",
  bares: "Bares & Noche",
  playas: "Playas",
  cultura: "Cultura & Arte",
  fitness: "Deporte & Fitness",
};

const MOOD_NAMES: Record<string, string> = {
  tranquilo: "Tranquilo",
  fiesta: "Fiesta & Rumba",
  romantico: "Romántico",
  familiar: "Familiar",
  cultural: "Cultural",
  aventura: "Aventura",
  trabajo: "Trabajo & Estudio",
  salud: "Salud & Bienestar",
};

const CURRENCY_NAMES: Record<string, string> = {
  mlc: "USD Clásica",
  cup: "CUP",
  usd: "USD",
  eur: "EUR",
  transfer: "Transferencia",
};

const categories = [
  {
    value: "cafes",
    label: "Cafeterías",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-[18px]">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <path d="M6 1v3M10 1v3M14 1v3" />
      </svg>
    ),
  },
  {
    value: "restaurantes",
    label: "Restaurantes",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-[18px]">
        <path d="M12 2a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" />
        <path d="M6 14h12M12 14v8" />
      </svg>
    ),
  },
  {
    value: "discotecas",
    label: "Discotecas",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-[18px]">
        <circle cx="8" cy="18" r="4" />
        <circle cx="18" cy="16" r="4" />
        <path d="M12 18V2l8 2v12" />
        <path d="M12 6l8 2" />
      </svg>
    ),
  },
  {
    value: "mercados",
    label: "Mercados",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-[18px]">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    value: "bares",
    label: "Bares & Noche",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-[18px]">
        <path d="M8 2v4l-2 8h12l-2-8V2" />
        <path d="M8 14v6a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-6" />
        <path d="M2 8h20" />
      </svg>
    ),
  },
  {
    value: "playas",
    label: "Playas",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-[18px]">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12c0-4 4-8 4-8s4 4 4 8-4 8-4 8-4-4-4-8z" />
        <path d="M3.5 7.5c2.5 1 5.5 1 8.5 0s6-1 8.5 0" />
        <path d="M3.5 16.5c2.5-1 5.5-1 8.5 0s6 1 8.5 0" />
      </svg>
    ),
  },
  {
    value: "cultura",
    label: "Cultura & Arte",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-[18px]">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
  },
  {
    value: "fitness",
    label: "Deporte & Fitness",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-[18px]">
        <path d="M6.5 6.5l11 11M6.5 17.5l11-11" />
        <path d="M14.5 4.5l5 5M4.5 14.5l5 5" />
        <path d="M9.5 2.5l12 12M2.5 9.5l12 12" />
      </svg>
    ),
  },
];

const moodOptions = [
  {
    value: "tranquilo",
    label: "Tranquilo",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-[18px]">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    value: "fiesta",
    label: "Fiesta & Rumba",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-[18px]">
        <circle cx="12" cy="8" r="5" />
        <path d="M12 13v9" />
        <path d="M8 22h8" />
      </svg>
    ),
  },
  {
    value: "romantico",
    label: "Romántico",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-[18px]">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    value: "familiar",
    label: "Familiar",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-[18px]">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    value: "cultural",
    label: "Cultural",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-[18px]">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    value: "aventura",
    label: "Aventura",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-[18px]">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <path d="M4 22v-7" />
      </svg>
    ),
  },
  {
    value: "trabajo",
    label: "Trabajo & Estudio",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-[18px]">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </svg>
    ),
  },
  {
    value: "salud",
    label: "Salud & Bienestar",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-[18px]">
        <path d="M9 12h6M12 9v6" />
        <rect x="2" y="4" width="20" height="16" rx="2" />
      </svg>
    ),
  },
] as const;

const currencyOptions = [
  { value: "mlc", code: "USD", name: "USD Clásica" },
  { value: "cup", code: "CUP", name: "Efectivo y Transferencia" },
  { value: "usd", code: "USD", name: "Dólar estadounidense" },
  { value: "eur", code: "EUR", name: "Euro" },
  { value: "transfer", code: "TRANSFER", name: "Transferencia" },
];

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const router = useRouter();
  /* Nombre y correo de la sesión. Antes se guardaban los de
     `DEFAULT_USER_PREFERENCES` —"Martín", "martin@email.com"—, que son valores
     de relleno del prototipo: el perfil acababa mostrando a otra persona. */
  const [identity, setIdentity] = useState<{ name: string; email: string } | null>(null);
  const [splashDone, setSplashDone] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [animTick, setAnimTick] = useState(0);

  const [location, setLocation] = useState("santiago");
  const [userId, setUserId] = useState<string | null>(null);
  const [gpsDetected, setGpsDetected] = useState(false);
  const [detectedName, setDetectedName] = useState<string | null>(null);
  const [interests, setInterests] = useState<Set<string>>(new Set(["cafes", "restaurantes"]));
  const [currencies, setCurrencies] = useState<Set<string>>(new Set(["mlc", "cup"]));
  const [moods, setMoods] = useState<Set<string>>(new Set(["tranquilo", "romantico"]));
  const locationDetectionStarted = useRef(false);

  function goToStep(step: number) {
    setCurrentStep(step);
    setAnimTick((t) => t + 1);
  }

  useEffect(() => {
    let alive = true;
    fetch("/api/me")
      .then((res) => res.json())
      .then((data: { authenticated: boolean; user: { id?: string; name: string; email: string } | null }) => {
        if (alive && data.authenticated && data.user) {
          setUserId(data.user.id ?? null);
          setIdentity({ name: data.user.name, email: data.user.email });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!showOnboarding || currentStep !== 0 || locationDetectionStarted.current) return;
    locationDetectionStarted.current = true;
    void handleUseGPS();
  }, [showOnboarding, currentStep]);

  const handleSplashDone = useCallback(() => {
    setSplashDone(true);
    setShowOnboarding(true);
    setAnimTick((t) => t + 1);
  }, []);

  async function handleUseGPS() {
    try {
      const pos = await getCurrentPosition({ useCache: false });
      const detected = detectNearestCity(pos.lat, pos.lng);
      setLocation(detected.value);
      setDetectedName(detected.label);
      setGpsDetected(true);
    } catch (err) {
      const code = (err as { code?: string }).code;
      const messages = GEO_ERROR_MESSAGES as Record<string, string>;
      toast.error(
        (code && messages[code]) ||
          "No pudimos detectar tu ubicación. Elige tu ciudad o inténtalo de nuevo.",
      );
      setGpsDetected(false);
    }
  }

  function toggleInterest(value: string) {
    setInterests((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function toggleCurrency(value: string) {
    setCurrencies((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function toggleMood(value: string) {
    setMoods((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function canProceed(): boolean {
    if (currentStep === 1) return interests.size > 0;
    if (currentStep === 2) return currencies.size > 0;
    if (currentStep === 3) return moods.size > 0;
    return true;
  }

  function handleContinue() {
    if (!canProceed()) return;
    if (currentStep === TOTAL_STEPS - 1) {
      finishOnboarding();
    } else {
      goToStep(currentStep + 1);
    }
  }

  function handleBack() {
    if (currentStep === 0) return;
    goToStep(currentStep - 1);
  }

  function finishOnboarding() {
    setShowOnboarding(false);
    setShowPreferences(true);
  }

  // Final del flujo: guarda una copia local y la versión persistente de la cuenta.
  const handleDone = useCallback(async () => {
    const nextPreferences = {
      onboardingCompleted: true,
      // La identidad viene de la sesión real y no de una persona de ejemplo.
      name: identity?.name || DEFAULT_USER_PREFERENCES.name,
      email: identity?.email || DEFAULT_USER_PREFERENCES.email,
      phone: DEFAULT_USER_PREFERENCES.phone,
      location,
      locationName: LOCATION_NAMES[location] ?? location,
      interests: Array.from(interests),
      moods: Array.from(moods),
      currencies: Array.from(currencies),
    };

    writeUserPreferences(nextPreferences, userId);

    try {
      const response = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nextPreferences.name,
          email: nextPreferences.email,
          location: nextPreferences.location,
          locationName: nextPreferences.locationName,
          interests: nextPreferences.interests,
          moods: nextPreferences.moods,
          currencies: nextPreferences.currencies,
          onboardingCompleted: true,
        }),
      });

      if (!response.ok) {
        toast.error("No pudimos guardar tus preferencias. Inténtalo de nuevo.");
        return;
      }
    } catch {
      toast.error("No pudimos guardar tus preferencias. Revisa tu conexión.");
      return;
    }

    router.push("/home");
  }, [router, identity, location, interests, moods, currencies, userId]);

  function handlePrefBack() {
    setShowPreferences(false);
    setShowOnboarding(true);
    goToStep(0);
  }

  function handleResetAI() {
    // Sin `style`: la pastilla ya la pone el `Toaster` del layout raíz con los
    // tokens del sistema. Aquí vivía una copia con `var(--foreground)`, que era
    // el lenguaje viejo y encima pisaba la del tema.
    toast("Perfil de IA reseteado");
  }

  return (
    <OnboardingShell>
      {!splashDone && <WelcomeSplash onComplete={handleSplashDone} />}

      {showOnboarding && (
        <div className="flex flex-col h-full" style={{ display: showOnboarding ? "flex" : "none" }}>
          <StatusBar />

          <StepBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />

          {currentStep < TOTAL_STEPS - 1 && (
            <button
              onClick={finishOnboarding}
              className="absolute top-[48px] right-4 z-10 bg-none border-none font-lv-display text-small font-medium text-ink-soft/75 cursor-pointer px-3 py-2 rounded-full transition-colors duration-500 hover:text-verde-600"
            >
              Saltar
            </button>
          )}

          <div className="flex-1 relative overflow-hidden">
            <div
              className="flex h-full transition-transform [transition-duration:400ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
              style={{ transform: `translateX(-${currentStep * 100}%)` }}
            >
              {/* Step 0: Location */}
              <Slide
                key={`slide-0-${animTick}`}
                step={0}
                currentStep={currentStep}
              >
                <SlideContent delay={50}>
                  <SlideIcon>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a8 8 0 0 0-8 8c0 4.42 8 12 8 12s8-7.58 8-12a8 8 0 0 0-8-8z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </SlideIcon>
                </SlideContent>
                <SlideContent delay={100}>
                  <h1 className="font-lv-display text-h2 font-bold leading-tight tracking-[-0.02em] text-ink mb-1">
                    ¿Dónde estás?
                  </h1>
                </SlideContent>
                <SlideContent delay={150}>
                  <p className="text-ink-soft/75 text-body leading-relaxed mb-6">
                    Para recomendarte lugares cerca de ti, cuéntanos en qué zona de Cuba te encuentras.
                  </p>
                </SlideContent>
                <SlideContent delay={200}>
                  <ProvinceMap location={location} />
                </SlideContent>
                <SlideContent delay={250}>
                  <LocationPicker
                    selected={location}
                    onSelect={setLocation}
                    gpsDetected={gpsDetected}
                    gpsLabel={detectedName ?? undefined}
                    onUseGPS={handleUseGPS}
                  />
                </SlideContent>
              </Slide>

              {/* Step 1: Interests */}
              <Slide
                key={`slide-1-${animTick}`}
                step={1}
                currentStep={currentStep}
              >
                <SlideContent delay={50}>
                  <SlideIcon>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </SlideIcon>
                </SlideContent>
                <SlideContent delay={100}>
                  <h1 className="font-lv-display text-h2 font-bold leading-tight tracking-[-0.02em] text-ink mb-1">
                    ¿Qué te gusta hacer?
                  </h1>
                </SlideContent>
                <SlideContent delay={150}>
                  <p className="text-ink-soft/75 text-body leading-relaxed mb-6">
                    Selecciona tus tipos de lugares favoritos. La IA aprenderá tus gustos.
                  </p>
                </SlideContent>
                <SlideContent delay={200} className="chip-grid">
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat, i) => (
                      <div
                        key={cat.value}
                        className="animate-chip-pop"
                        style={{
                          animationDelay: `${200 + i * 30}ms`,
                          animationFillMode: "both",
                        }}
                      >
                        <PreferenceChip
                          selected={interests.has(cat.value)}
                          icon={cat.icon}
                          label={cat.label}
                          onClick={() => toggleInterest(cat.value)}
                        />
                      </div>
                    ))}
                  </div>
                </SlideContent>
              </Slide>

              {/* Step 2: Currencies */}
              <Slide
                key={`slide-2-${animTick}`}
                step={2}
                currentStep={currentStep}
              >
                <SlideContent delay={50}>
                  <SlideIcon>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 8h8M8 12h6M8 16h4" />
                    </svg>
                  </SlideIcon>
                </SlideContent>
                <SlideContent delay={100}>
                  <h1 className="font-lv-display text-h2 font-bold leading-tight tracking-[-0.02em] text-ink mb-1">
                    ¿Qué monedas usas?
                  </h1>
                </SlideContent>
                <SlideContent delay={150}>
                  <p className="text-ink-soft/75 text-body leading-relaxed mb-6">
                    Selecciona las monedas con las que pagas. Filtraremos lugares según tu preferencia.
                  </p>
                </SlideContent>
                <SlideContent delay={200}>
                  <div className="flex flex-col gap-3">
                    {currencyOptions.map((cur, i) => (
                      <div
                        key={cur.value}
                        className="animate-fade-up"
                        style={{
                          animationDelay: `${200 + i * 40}ms`,
                          animationFillMode: "both",
                        }}
                      >
                        <CurrencyToggle
                          code={cur.code}
                          name={cur.name}
                          active={currencies.has(cur.value)}
                          onClick={() => toggleCurrency(cur.value)}
                        />
                      </div>
                    ))}
                  </div>
                </SlideContent>
              </Slide>

              {/* Step 3: Moods */}
              <Slide
                key={`slide-3-${animTick}`}
                step={3}
                currentStep={currentStep}
              >
                <SlideContent delay={50}>
                  <SlideIcon>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                      <path d="M9 9h.01M15 9h.01" />
                    </svg>
                  </SlideIcon>
                </SlideContent>
                <SlideContent delay={100}>
                  <h1 className="font-lv-display text-h2 font-bold leading-tight tracking-[-0.02em] text-ink mb-1">
                    ¿Qué ambiente buscas?
                  </h1>
                </SlideContent>
                <SlideContent delay={150}>
                  <p className="text-ink-soft/75 text-body leading-relaxed mb-6">
                    Cuéntanos el tipo de planes que te gustan para recomendaciones más precisas.
                  </p>
                </SlideContent>
                <SlideContent delay={200} className="chip-grid">
                  <div className="flex flex-wrap gap-2">
                    {moodOptions.map((mood, i) => (
                      <div
                        key={mood.value}
                        className="animate-chip-pop"
                        style={{
                          animationDelay: `${200 + i * 30}ms`,
                          animationFillMode: "both",
                        }}
                      >
                        <PreferenceChip
                          selected={moods.has(mood.value)}
                          icon={mood.icon}
                          label={mood.label}
                          onClick={() => toggleMood(mood.value)}
                        />
                      </div>
                    ))}
                  </div>
                </SlideContent>
              </Slide>
            </div>
          </div>

          <StepDots currentStep={currentStep} totalSteps={TOTAL_STEPS} />

          <div className="px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 bg-gradient-to-t from-sand-warm via-sand-warm to-transparent flex gap-3 flex-shrink-0">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="inline-flex items-center justify-center gap-2 flex-1 px-6 py-3 rounded-full font-lv-display text-sm font-semibold border border-ink/10 bg-white text-ink transition-all duration-500 ease-outquint min-h-12 hover:bg-verde-50 active:scale-[0.98]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[18px]">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Atrás
              </button>
            )}
            <button
              onClick={handleContinue}
              disabled={!canProceed()}
              className="inline-flex items-center justify-center gap-2 flex-1 px-6 py-3 rounded-full font-lv-display text-sm font-semibold bg-verde-400 text-verde-950 shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)] transition-all duration-500 ease-outquint min-h-12 hover:bg-verde-300 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
            >
              {currentStep === TOTAL_STEPS - 1 ? "Comenzar" : "Continuar"}
            </button>
          </div>
        </div>
      )}

      {showPreferences && (
        <div className="flex flex-col h-full animate-fade-up">
          <PreferencesScreen
            locationName={LOCATION_NAMES[location] ?? location}
            interests={Array.from(interests).map((v) => ({ value: v, label: INTEREST_NAMES[v] ?? v }))}
            moods={Array.from(moods).map((v) => ({ value: v, label: MOOD_NAMES[v] ?? v }))}
            currencies={Array.from(currencies).map((v) => ({ value: v, label: CURRENCY_NAMES[v] ?? v }))}
            onBack={handlePrefBack}
            onResetAI={handleResetAI}
            onDone={handleDone}
          />
        </div>
      )}
    </OnboardingShell>
  );
}

function Slide({
  step,
  currentStep,
  children,
}: {
  step: number;
  currentStep: number;
  children: React.ReactNode;
}) {
  const isActive = step === currentStep;
  return (
    <div
      className="min-w-full px-5 flex flex-col overflow-y-auto pb-[100px] scrollbar-hide"
      data-active={isActive}
    >
      {children}
    </div>
  );
}

function SlideIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="size-16 rounded-2xl bg-verde-50 flex items-center justify-center mb-6 flex-shrink-0 mt-2">
      <div className="size-8 text-verde-700">{children}</div>
    </div>
  );
}

function SlideContent({
  children,
  delay,
  className,
}: {
  children: React.ReactNode;
  delay: number;
  className?: string;
}) {
  return (
    <div
      className={cn("animate-fade-up", className)}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      {children}
    </div>
  );
}


