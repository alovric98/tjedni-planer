export default function TjedniPlanLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent-fg/20 border-t-accent-fg" />
      <p className="text-sm text-ink-muted">Učitavam tjedni plan…</p>
    </div>
  );
}
