import { LoadingState } from "@/components/ui";

export default function AdminLoading() {
  return (
    <div className="rounded-2xl border border-ink/5 bg-white shadow-soft">
      <LoadingState label="Cargando panel…" />
    </div>
  );
}
