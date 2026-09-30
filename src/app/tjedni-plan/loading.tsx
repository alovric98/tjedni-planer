import { Spinner } from "@/components/ui/Button";

export default function TjedniPlanLoading() {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <Spinner className="h-6 w-6 text-accent-fg" />
      <p className="text-label text-ink-muted">Učitavam tjedni plan…</p>
    </div>
  );
}
