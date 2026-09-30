import type { Metadata } from "next";
import { LoginButton } from "./LoginButton";

export const metadata: Metadata = { title: "Prijava" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; expired?: string }>;
}) {
  const { next, error, expired } = await searchParams;
  const isExpired = expired === "1";

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 sm:min-h-[70vh]">
      <div className="w-full max-w-sm rounded-surface border border-border bg-surface-1 px-8 py-10 text-center shadow-raised sm:py-14">
        <svg
          viewBox="0 0 24 24"
          className="mx-auto h-9 w-9 text-accent-fg"
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

        <h1 className="mt-6 text-title text-ink">Tjedni planer</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
          {isExpired
            ? "Sesija je istekla. Prijavi se ponovno - tvoji recepti, plan i popisi su sačuvani."
            : "Isplaniraj ručkove za tjedan i usporedi cijene u trgovinama."}
        </p>

        {!isExpired && (
          <ul className="mx-auto mt-6 max-w-[15rem] space-y-2 text-left text-label text-ink-muted">
            {["Dodaj recepte i rasporedi ih po danima", "Automatski popis za kupovinu", "Jeftinija košarica: Lidl ili Kaufland"].map(
              (line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <span aria-hidden="true" className="mt-[0.4375rem] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-fg" />
                  {line}
                </li>
              )
            )}
          </ul>
        )}

        {error && (
          <p className="mt-6 rounded-control bg-warn-bg px-3 py-2 text-label text-warn">
            Prijava nije uspjela. Pokušaj ponovno.
          </p>
        )}

        <div className="mt-8">
          <LoginButton next={next} expired={isExpired} />
        </div>
      </div>
    </div>
  );
}
