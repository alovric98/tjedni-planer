import { BasketIcon } from "@/components/ui/icons";

export default function KosaricaLoading() {
  return (
    <div role="status">
      <span className="sr-only">Stavljam tvoje proizvode u košaricu…</span>
      <h1 aria-hidden="true" className="text-title text-ink">
        Košarica
      </h1>

      <div aria-hidden="true" className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="animate-basket-bounce text-accent-fg">
          <BasketIcon className="h-14 w-14" />
        </div>
        <p className="text-heading font-semibold text-ink">Stavljam tvoje proizvode u košaricu…</p>
        <div className="h-2 w-56 overflow-hidden rounded-full bg-surface-2">
          <div className="animate-basket-fill h-full rounded-full bg-accent" />
        </div>
      </div>

      <div
        aria-hidden="true"
        className="animate-pulse divide-y divide-border rounded-surface border border-border bg-surface-1 shadow-raised"
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-start justify-between gap-4 px-4 py-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-1/2 rounded-control bg-surface-2" />
              <div className="h-3.5 w-3/4 rounded-control bg-surface-2" />
            </div>
            <div className="h-5 w-16 rounded-control bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
