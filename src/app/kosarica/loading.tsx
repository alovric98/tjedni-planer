export default function KosaricaLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
      <div className="animate-basket-bounce text-6xl">🛒</div>
      <p className="text-lg font-semibold text-ink">Stavljam tvoje proizvode u košaricu…</p>
      <div className="h-2 w-56 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-brand animate-basket-fill" />
      </div>
    </div>
  );
}
