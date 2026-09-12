import { LoadingState } from "@/components/ui";

export default function AdminLoading() {
  return (
    <div className="rounded-lv-lg border border-border bg-surface">
      <LoadingState label="Cargando panel…" />
    </div>
  );
}
