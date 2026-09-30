import type { Metadata } from "next";
import { LoginButton } from "./LoginButton";

export const metadata: Metadata = { title: "Prijava" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 sm:min-h-[70vh]">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface-1 px-8 py-8 text-center sm:py-12">
        <svg
          viewBox="0 0 24 24"
          className="mx-auto h-10 w-10 text-ink"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 7h18l-1.6 10.4a2 2 0 0 1-2 1.6H6.6a2 2 0 0 1-2-1.6L3 7Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V6a4 4 0 0 1 8 0v1" />
        </svg>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink">Tjedni planer</h1>
        <p className="mt-2 text-base leading-relaxed text-ink-muted">
          Prijavi se da spremiš svoje trgovine i popise za kupovinu.
        </p>

        {error && (
          <p className="mt-6 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">
            Prijava nije uspjela. Pokušaj ponovno.
          </p>
        )}

        <div className="mt-8">
          <LoginButton next={next} />
        </div>
      </div>
    </div>
  );
}
