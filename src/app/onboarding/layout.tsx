export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-dvh overflow-hidden bg-sand font-lv text-ink">
      {children}
    </div>
  );
}
