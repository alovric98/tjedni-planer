export default function ReceptiLoading() {
  return (
    <div role="status" className="mx-auto w-full max-w-2xl lg:max-w-5xl">
      <span className="sr-only">Učitavam recepte…</span>
      <h1 aria-hidden="true" className="text-title text-ink">
        Recepti
      </h1>
      <div aria-hidden="true" className="mt-6 grid items-start gap-3 lg:grid-cols-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-surface border border-border bg-surface-1 p-5 shadow-raised">
            <div className="h-5 w-2/3 rounded-control bg-surface-2" />
            <div className="mt-3 h-4 w-24 rounded-full bg-surface-2" />
            <div className="mt-5 space-y-3">
              <div className="h-3.5 w-full rounded-control bg-surface-2" />
              <div className="h-3.5 w-5/6 rounded-control bg-surface-2" />
              <div className="h-3.5 w-4/6 rounded-control bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
