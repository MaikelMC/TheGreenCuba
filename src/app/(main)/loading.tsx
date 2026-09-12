import { LoadingState } from "@/components/ui";

export default function MainLoading() {
  return (
    <div className="grid min-h-[calc(100vh-var(--header-h))] place-items-center">
      <LoadingState label="Cargando…" />
    </div>
  );
}
