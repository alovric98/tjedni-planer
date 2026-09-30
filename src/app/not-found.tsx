import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 text-center sm:min-h-[70vh]">
      <svg
        viewBox="0 0 24 24"
        className="h-10 w-10 text-ink-muted"
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
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 11.5l5 5m0-5-5 5" />
      </svg>

      <h1 className="mt-6 text-title text-ink">Stranica ne postoji</h1>
      <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-ink-muted">
        Ova košarica je prazna — stranicu koju tražiš nismo pronašli.
      </p>

      <Link
        href="/recepti"
        className={`mt-8 ${buttonClasses({ size: "lg" })}`}
      >
        Natrag na recepte
      </Link>
    </div>
  );
}
