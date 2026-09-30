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
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 text-center sm:min-h-[70vh]">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Tjedni planer</h1>
        <p className="mt-2 text-base leading-relaxed text-ink-muted">
          Prijavi se da spremiš svoje trgovine i popise za kupovinu.
        </p>

        {error && (
          <p className="mt-4 text-sm text-warn">Prijava nije uspjela. Pokušaj ponovno.</p>
        )}

        <div className="mt-8">
          <LoginButton next={next} />
        </div>
      </div>
    </div>
  );
}
