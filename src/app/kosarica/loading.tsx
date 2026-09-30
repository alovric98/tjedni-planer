function BasketIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-16 w-16 text-accent-fg"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18l-1.6 10.4a2 2 0 0 1-2 1.6H6.6a2 2 0 0 1-2-1.6L3 7Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V6a4 4 0 0 1 8 0v1" />
    </svg>
  );
}

export default function KosaricaLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
      <div className="animate-basket-bounce">
        <BasketIcon />
      </div>
      <p className="text-lg font-semibold text-ink">Stavljam tvoje proizvode u košaricu…</p>
      <div className="h-2 w-56 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent animate-basket-fill" />
      </div>
    </div>
  );
}
